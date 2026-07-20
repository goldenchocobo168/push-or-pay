import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { compute, todaySGT, roast, cheer } from "../../lib/penalty.mjs";

// Single API function for the whole app. Route via ?action=... .
export const config = { path: "/api" };

const MAX_NAME = 40;
const MAX_HABIT = 80;
const ADMIN_KEY = process.env.PP_ADMIN_KEY || "";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
}

function newId() {
  // Short, URL-friendly, low collision for a personal-scale app.
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

// Public projection of a challenge for a given viewer role.
function view(c, role) {
  const m = compute(c);
  const base = {
    role,
    id: c.id,
    owner_name: c.owner_name,
    partner_name: c.partner_name,
    habit: c.habit,
    penalty: c.penalty,
    currency: c.currency || "$",
    start_date: c.start_date,
    settled_through: c.settled_through || null,
    reactions: c.reactions || {},
    ...m,
    cheer: cheer(m.streak),
  };
  if (role === "owner") {
    base.invite_link = `/c/${c.id}?t=${c.partner_token}`;
    base.owner_link = `/c/${c.id}?t=${c.owner_token}`;
  } else {
    base.roast = roast(m.missed_count);
  }
  return base;
}

function roleFor(c, token) {
  if (token && token === c.owner_token) return "owner";
  if (token && token === c.partner_token) return "partner";
  return null;
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  // globalThis.__PP_STORE__ is a test seam (in-memory store); prod uses Blobs.
  const store = globalThis.__PP_STORE__ || getStore("challenges");

  try {
    // ---- create -------------------------------------------------------
    if (action === "create") {
      const b = await req.json().catch(() => ({}));
      const owner_name = clean(b.owner_name, MAX_NAME) || "You";
      const partner_name = clean(b.partner_name, MAX_NAME) || "Your partner";
      const habit = clean(b.habit, MAX_HABIT) || "1 Push-up";
      let penalty = Math.round(Number(b.penalty));
      if (!Number.isFinite(penalty)) penalty = 10;
      penalty = Math.min(1000, Math.max(1, penalty));
      const currency = clean(b.currency, 3) || "$";

      const c = {
        id: newId(),
        owner_name,
        partner_name,
        habit,
        penalty,
        currency,
        owner_token: randomUUID(),
        partner_token: randomUUID(),
        start_date: todaySGT(),
        checkins: {},
        forgiven: {},
        reactions: {},
        settled_through: null,
        settlements: [],
        share_count: 0,
        partner_first_seen: null,
        created_at: Date.now(),
      };
      await store.setJSON(c.id, c);
      return json({
        id: c.id,
        owner_link: `/c/${c.id}?t=${c.owner_token}`,
        invite_link: `/c/${c.id}?t=${c.partner_token}`,
      });
    }

    // ---- stats (admin-key gated) -------------------------------------
    // Real, un-faked metrics derived by listing every stored challenge:
    // signups, activation, retention, usage, shares. No accounts exist, so a
    // "unique user" == a created challenge (owner) plus each partner who opened
    // their invite link.
    if (action === "stats") {
      const key = url.searchParams.get("key") || "";
      if (!ADMIN_KEY || key !== ADMIN_KEY) return json({ error: "unauthorized" }, 401);
      const { blobs } = await store.list();
      const today = todaySGT();

      let signups = 0, partners = 0, totalCheckins = 0, shares = 0;
      let activated = 0, retained2 = 0, retained7 = 0, activeLast7 = 0;
      const signupsByDay = {}; // YYYY-MM-DD -> count
      const recent = [];

      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (!c || !c.id) continue;
        signups++;
        if (c.partner_first_seen) partners++;
        shares += Number(c.share_count || 0);
        const days = Object.keys(c.checkins || {});
        totalCheckins += days.length;
        if (days.length >= 1) activated++;
        if (days.length >= 2) retained2++;
        if (days.length >= 7) retained7++;
        // active in the last 7 days?
        const active7 = days.some((d) => (Date.parse(today) - Date.parse(d)) / 86400000 <= 7);
        if (active7) activeLast7++;
        const day = (c.start_date || (c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "?"));
        signupsByDay[day] = (signupsByDay[day] || 0) + 1;
        const m = compute(c);
        recent.push({
          id: c.id, habit: c.habit, penalty: c.penalty, currency: c.currency,
          owner: c.owner_name, partner: c.partner_name,
          streak: m.streak, checkins: days.length, missed: m.missed_count,
          debt: m.debt, shares: c.share_count || 0,
          partner_joined: !!c.partner_first_seen, created: c.created_at || 0,
        });
      }
      recent.sort((a, b) => (b.created || 0) - (a.created || 0));

      // last 30 day signup series
      const series = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10);
        series.push({ date: d, count: signupsByDay[d] || 0 });
      }

      return json({
        totals: {
          signups, partners_joined: partners, total_checkins: totalCheckins, shares,
          activated, active_last_7d: activeLast7,
          retention_2d: signups ? +(retained2 / signups * 100).toFixed(1) : 0,
          retention_7d: signups ? +(retained7 / signups * 100).toFixed(1) : 0,
          activation_rate: signups ? +(activated / signups * 100).toFixed(1) : 0,
          partner_join_rate: signups ? +(partners / signups * 100).toFixed(1) : 0,
        },
        signups_by_day: series,
        recent: recent.slice(0, 60),
      });
    }

    // All other actions need an existing challenge + a token.
    const id = url.searchParams.get("id") || "";
    const token = url.searchParams.get("t") || "";
    if (!id) return json({ error: "missing id" }, 400);
    const c = await store.get(id, { type: "json" });
    if (!c) return json({ error: "not found" }, 404);
    const role = roleFor(c, token);
    if (!role) return json({ error: "invalid link" }, 403);

    // ---- get ----------------------------------------------------------
    if (action === "get") {
      // Activation: record the first time the partner opens their invite link.
      if (role === "partner" && !c.partner_first_seen) {
        c.partner_first_seen = Date.now();
        await store.setJSON(id, c);
      }
      return json(view(c, role));
    }

    // ---- share (either role) — usage/virality signal -----------------
    if (action === "share") {
      c.share_count = Number(c.share_count || 0) + 1;
      await store.setJSON(id, c);
      return json({ ok: true, shares: c.share_count });
    }

    // ---- checkin (owner only) ----------------------------------------
    if (action === "checkin") {
      if (role !== "owner") return json({ error: "only the challenger can check in" }, 403);
      const today = todaySGT();
      c.checkins = c.checkins || {};
      if (!c.checkins[today]) c.checkins[today] = Date.now();
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- forgive (partner only) --------------------------------------
    if (action === "forgive") {
      if (role !== "partner") return json({ error: "only your partner can forgive" }, 403);
      const b = await req.json().catch(() => ({}));
      const date = clean(b.date, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "bad date" }, 400);
      c.forgiven = c.forgiven || {};
      c.forgiven[date] = Date.now();
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- settle / mark paid (owner only) -----------------------------
    if (action === "settle") {
      if (role !== "owner") return json({ error: "only the challenger can settle" }, 403);
      const before = compute(c);
      c.settled_through = todaySGT();
      c.settlements = c.settlements || [];
      c.settlements.push({ date: todaySGT(), amount: before.debt });
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- react (either role) -----------------------------------------
    if (action === "react") {
      const b = await req.json().catch(() => ({}));
      const date = clean(b.date, 10);
      const emoji = clean(b.emoji, 8);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !emoji) return json({ error: "bad react" }, 400);
      c.reactions = c.reactions || {};
      const list = c.reactions[date] || [];
      list.push({ emoji, who: role, ts: Date.now() });
      c.reactions[date] = list.slice(-12); // cap noise
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: "server error", detail: String(e && e.message || e) }, 500);
  }
};
