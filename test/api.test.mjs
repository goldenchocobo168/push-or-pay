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
const { default: mod } = await import("../api/index.js");
const handler = mod.fetch;
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
eq(og.data.invite_variant, 0, "invite_variant defaults to 0 when not sent at create");
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
eq((await call("share", { id, t: ownerT }, { cta_pool: "tax_raised", cta_variant: 0 })).data.shares, 2, "tax_raised share counted");

console.log("invite_click — attribute an invite send to the control that fired it");
eq((await call("invite_click", { id, t: ownerT }, { channel: "copy" })).data.ok, true, "copy click tracked");
eq((await call("invite_click", { id, t: ownerT }, { channel: "whatsapp_dashboard" })).data.ok, true, "whatsapp_dashboard click tracked");
eq((await call("invite_click", { id, t: ownerT }, { channel: "whatsapp_dashboard" })).data.ok, true, "whatsapp_dashboard click tracked again");
eq((await call("invite_click", { id, t: ownerT }, { channel: "not-a-real-channel" })).data.ok, true, "unknown channel doesn't error, just isn't counted");

console.log("push subscribe/unsubscribe");
{
  eq((await call("push_subscribe", { id, t: partnerT }, { subscription: { endpoint: "https://x", keys: { p256dh: "a", auth: "b" } } })).status, 403, "partner can't enable owner's reminders");
  eq((await call("push_subscribe", { id, t: ownerT }, { subscription: {} })).status, 400, "bad subscription rejected");
  const sub = await call("push_subscribe", { id, t: ownerT }, { subscription: { endpoint: "https://push.example/ep1", keys: { p256dh: "pkey", auth: "akey" } } });
  eq(sub.data.ok, true, "subscribe ok");
  eq((await call("get", { id, t: ownerT })).data.push_enabled, true, "push_enabled true after subscribe");
  const unsub = await call("push_unsubscribe", { id, t: ownerT }, {});
  eq(unsub.data.ok, true, "unsubscribe ok");
  eq((await call("get", { id, t: ownerT })).data.push_enabled, false, "push_enabled false after unsubscribe");
  // re-subscribe so the stats assertions below see 1 push-enabled signup
  await call("push_subscribe", { id, t: ownerT }, { subscription: { endpoint: "https://push.example/ep1", keys: { p256dh: "pkey", auth: "akey" } } });
}

console.log("visit ping");
eq((await call("visit", {}, { ref: "direct" })).data.ok, true, "visit ping ok");
eq((await call("visit", {}, { ref: "reddit", platform: "ios_safari" })).data.ok, true, "visit ping ok (2nd, reddit ref, ios_safari platform)");
eq((await call("visit", {}, { ref: "totally-not-a-category", platform: "totally-not-a-platform" })).data.ok, true, "visit ping ok (3rd, unknown ref/platform folds to other)");

console.log("invite_variant — copy-variant lever on the invite card, tracked against partner-join outcome");
const cv = await call("create", {}, { owner_name: "Variant", partner_name: "P", daily_target: 10, penalty_amount: 10, currency: "$", created_via: "self", invite_variant: 1 });
const cvOwnerT = tokenOf(cv.data.owner_link);
eq((await call("get", { id: cv.data.id, t: cvOwnerT })).data.invite_variant, 1, "invite_variant round-trips as sent");
const cvNeg = await call("create", {}, { owner_name: "Neg", partner_name: "P", daily_target: 10, penalty_amount: 10, currency: "$", created_via: "self", invite_variant: -5 });
eq((await call("get", { id: cvNeg.data.id, t: tokenOf(cvNeg.data.owner_link) })).data.invite_variant, 0, "out-of-range invite_variant clamps to 0, no crash");

console.log("stats");
eq((await call("stats", {})).status, 401, "stats needs key");
const st = await call("stats", { key: "testkey123" });
eq(st.data.totals.signups, 3, "3 signups (original + the 2 invite_variant challenges)");
eq(st.data.totals.partner_join_by_invite_variant["0"], 50, "invite_variant 0 bucket: original (joined) + negative-clamped (not joined) averages to 50%");
eq(st.data.totals.partner_join_by_invite_variant["1"], 0, "invite_variant 1 (partner never opened the link) shows 0%");
eq(st.data.totals.invite_clicks_by_channel.copy, 1, "1 copy invite click attributed");
eq(st.data.totals.invite_clicks_by_channel.whatsapp_dashboard, 2, "2 whatsapp_dashboard invite clicks attributed");
ok(!("not-a-real-channel" in st.data.totals.invite_clicks_by_channel), "unknown channel never enters the aggregate");
eq(st.data.totals.total_sessions, 1, "1 session");
ok(st.data.totals.partners_joined >= 1, "watcher activation counted");
eq(st.data.totals.push_enabled, 1, "1 push-enabled signup");
eq(st.data.totals.push_enabled_rate, +(1 / 3 * 100).toFixed(1), "push_enabled_rate is 1 of 3 signups now that invite_variant added 2 more");
eq(st.data.totals.visits_total, 3, "3 visits counted");
ok(Array.isArray(st.data.visits_by_day) && st.data.visits_by_day.length === 30, "visits_by_day 30-day series");
eq(st.data.visits_by_day[st.data.visits_by_day.length - 1].count, 3, "today's visits bucket has 3");
eq(st.data.totals.visits_by_ref.direct, 1, "1 direct visit (no ref sent)");
eq(st.data.totals.visits_by_ref.reddit, 1, "1 reddit visit");
eq(st.data.totals.visits_by_ref.other, 1, "unknown ref category folds to other");
eq(st.data.totals.visits_by_platform.other, 2, "2 visits fold to other platform (no platform sent + unknown platform)");
eq(st.data.totals.visits_by_platform.ios_safari, 1, "1 ios_safari visit");

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
  const pid = p.data.id, pOwnerT = tokenOf(p.data.owner_link), pPartnerT = tokenOf(p.data.invite_link);

  console.log("prank creator is auto-accepted (holds partner_token, already 'accepted' by creating it)");
  const ppg = await call("get", { id: pid, t: pPartnerT });
  eq(ppg.data.role, "partner", "creator's link is role partner");
  eq(ppg.data.accepted, true, "prank creator skips the invitee 'accept' screen — they already made it");

  console.log("prank doer sees the prankster as already watching, not an 'invite' card");
  const pog = await call("get", { id: pid, t: pOwnerT });
  eq(pog.data.role, "owner", "doer's link is role owner");
  eq(pog.data.accepted, true, "doer sees partner as already watching, no pointless self-invite");

  console.log("self mode is unaffected: real partner still starts unaccepted");
  const sg = await call("get", { id, t: partnerT });
  eq(sg.data.accepted, true, "self-mode partner already accepted earlier in this suite, unaffected by prank change");
}

console.log("guards");
eq((await call("get", { id, t: "bad" })).status, 403, "bad token 403");
eq((await call("get", { id: "deadbeef", t: ownerT })).status, 404, "missing 404");

console.log(`\nAll ${pass} handler assertions passed ✅`);
