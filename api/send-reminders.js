import { getStore } from "../lib/store.mjs";
import webpush from "web-push";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isDone, todaySGT, pick } from "../lib/penalty.mjs";

// Vercel Cron hits this daily, before the SGT day boundary that resets
// todaySGT() — 20:00 SGT = 12:00 UTC. Schedule lives in vercel.json.

const COPY = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/copy.json"), "utf8")
);

// Public VAPID key — not secret, must match public/app.js's VAPID_PUBLIC_KEY.
const VAPID_PUBLIC_KEY = "BDAI7fbZBLRikRquNoMUucL9jTeej544F5xJLSf_Z8cShLOeGKivTvUP225lAvrOm1kCbNfRPaD5HbnPahMo7AI";

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Core send loop, decoupled from web-push so it can run against a fake
// `send` in tests. Returns counts for observability in function logs.
export async function runSendReminders(store, send) {
  const { blobs } = await store.list();
  const today = todaySGT();
  let sent = 0, skipped = 0, cleaned = 0, failed = 0;
  for (const b of blobs) {
    if (b.key.startsWith("visits:")) continue;
    const c = await store.get(b.key, { type: "json" });
    if (!c || !c.id || !c.push_subscription || c.is_test) continue;
    if (isDone(c, today)) { skipped++; continue; }
    const body = pick(COPY.push_reminder, hashSeed(c.id + today)) || "Your streak is still waiting on you. 🔥";
    const payload = JSON.stringify({ title: "Push or Pay", body, url: `/c/${c.id}?t=${c.owner_token}` });
    try {
      await send(c.push_subscription, payload);
      sent++;
    } catch (e) {
      const status = e && (e.statusCode || e.status);
      if (status === 404 || status === 410) {
        delete c.push_subscription;
        c.push_subscribed_at = null;
        await store.setJSON(c.id, c);
        cleaned++;
      } else {
        failed++;
      }
    }
  }
  return { sent, skipped, cleaned, failed };
}

async function handler(req) {
  // Vercel Cron requests carry a bearer secret in production; reject anything
  // else so this endpoint can't be used to spam every subscriber on demand.
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
  }

  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  if (!privateKey || !subject) {
    return new Response(JSON.stringify({ error: "VAPID not configured" }), { status: 500 });
  }
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, privateKey);
  const store = globalThis.__PP_STORE__ || getStore("challenges");
  const result = await runSendReminders(store, (subscription, payload) => webpush.sendNotification(subscription, payload));
  return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
}

export default { fetch: handler };
