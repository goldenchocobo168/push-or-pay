// Unit tests for the daily push-reminder send loop (netlify/functions/send-reminders.js).
// Runs the core loop against an in-memory store + a fake `send`, so no real
// web-push network calls happen. Run: node test/send-reminders.test.mjs
import assert from "node:assert";

function memStore(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async get(k) { const s = m.get(k); return s == null ? null : JSON.parse(s); },
    async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
  };
}

const { runSendReminders } = await import("../netlify/functions/send-reminders.js");
const { todaySGT } = await import("../lib/penalty.mjs");

let pass = 0;
const ok = (c, n) => { assert.ok(c, n); console.log("  ✓", n); pass++; };
const eq = (a, b, n) => { assert.strictEqual(a, b, `${n} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); console.log("  ✓", n); pass++; };

const today = todaySGT();

console.log("send loop: skip done, send pending, clean up dead, leave unsubscribed alone");
{
  const store = memStore({
    "visits:2026-07-30": { count: 3, by_ref: {} }, // must be ignored, not a challenge
    done: { id: "done", push_subscription: { endpoint: "e1", keys: { p256dh: "a", auth: "b" } }, sessions: { [today]: { reps: 10, target: 10 } }, daily_target: 10, owner_token: "t1" },
    pending: { id: "pending", push_subscription: { endpoint: "e2", keys: { p256dh: "a", auth: "b" } }, sessions: {}, daily_target: 10, owner_token: "t2" },
    dead: { id: "dead", push_subscription: { endpoint: "e3", keys: { p256dh: "a", auth: "b" } }, sessions: {}, daily_target: 10, owner_token: "t3" },
    unsub: { id: "unsub", sessions: {}, daily_target: 10, owner_token: "t4" },
    test_row: { id: "test_row", is_test: true, push_subscription: { endpoint: "e5", keys: { p256dh: "a", auth: "b" } }, sessions: {}, daily_target: 10, owner_token: "t5" },
    other_err: { id: "other_err", push_subscription: { endpoint: "e6", keys: { p256dh: "a", auth: "b" } }, sessions: {}, daily_target: 10, owner_token: "t6" },
  });

  const sentTo = [];
  const send = async (sub, payload) => {
    sentTo.push(sub.endpoint);
    if (sub.endpoint === "e3") { const e = new Error("gone"); e.statusCode = 410; throw e; }
    if (sub.endpoint === "e6") { const e = new Error("server error"); e.statusCode = 500; throw e; }
    const data = JSON.parse(payload);
    ok(data.title && data.body && data.url, `payload for ${sub.endpoint} has title/body/url`);
  };

  const result = await runSendReminders(store, send);
  eq(result.sent, 1, "1 send succeeded (pending)");
  eq(result.skipped, 1, "1 skipped (done today)");
  eq(result.cleaned, 1, "1 cleaned up (410 Gone)");
  eq(result.failed, 1, "1 failed (non-410/404 error, subscription kept)");

  ok(sentTo.includes("e2"), "sent to pending subscriber");
  ok(sentTo.includes("e3"), "attempted dead subscriber");
  ok(sentTo.includes("e6"), "attempted other_err subscriber");
  ok(!sentTo.includes("e1"), "did not send to done-today subscriber");
  ok(!sentTo.includes("e4"), "did not send to no-subscription challenge");
  ok(!sentTo.includes("e5"), "did not send to is_test challenge");

  const deadAfter = await store.get("dead");
  ok(!deadAfter.push_subscription, "dead subscription removed from record");
  eq(deadAfter.push_subscribed_at, null, "push_subscribed_at cleared on cleanup");

  const otherErrAfter = await store.get("other_err");
  ok(otherErrAfter.push_subscription, "non-410/404 failure keeps the subscription (transient, not cleaned)");
}

console.log(`\nAll ${pass} send-reminders assertions passed ✅`);
