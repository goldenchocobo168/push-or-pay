import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { compute, todaySGT, usdHint, money } from "../../lib/penalty.mjs";

// Single API function for Push or Pay. Route via ?action=... .
export const config = { path: "/api" };

const MAX_NAME = 40;
const ADMIN_KEY = process.env.PP_ADMIN_KEY || "";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
const newId = () => randomUUID().replace(/-/g, "").slice(0, 8);

// Public projection for a viewer role. owner = the DOER (does push-ups);
// partner = the PROFITEER (earns on misses, can raise the penalty, cheers).
function view(c, role) {
  const m = compute(c);
  const base = {
    role,
    id: c.id,
    owner_name: c.owner_name,
    partner_name: c.partner_name,
    daily_target: c.daily_target,
    penalty_amount: c.penalty_amount,
    currency: c.currency || "$",
    penalty_display: money(c.penalty_amount, c.currency),
    penalty_usd_hint: usdHint(c.penalty_amount, c.currency),
    created_via: c.created_via || "self",
    start_date: c.start_date,
    cheers: c.cheers || {},
    penalty_events: c.penalty_events || [],
    sessions: c.sessions || {},   // for heatmap day-detail (reps/duration)
    ...m,
    partner_earned_display: money(m.partner_earned, c.currency),
    week_earned_display: money(m.week_earned, c.currency),
    accepted: !!c.partner_accepted,   // has the watcher accepted?
    // Secret Mode: free 30-day challenge; Day-19 one-time reveal unlocks beyond 30.
    secret_unlocked: !!c.secret_unlocked,
    display_streak: c.secret_unlocked ? m.streak : Math.min(m.streak, CAP),
    streak_cap: c.secret_unlocked ? null : CAP,
    challenge_complete: !c.secret_unlocked && m.streak >= CAP,
    hardcore_tier: c.secret_unlocked ? hardcoreTier(m.streak) : null,
  };
  // The reveal only ever fires for the doer, once, at day 19+, pre-unlock.
  if (role === "owner") base.secret_reveal = (m.streak >= 19 && !c.secret_unlocked && !c.secret_reveal_shown_at);
  if (role === "owner") {
    base.invite_link = `/c/${c.id}?t=${c.partner_token}`;
    // "Your wife raised your Lazy Tax 🚨" banner: latest watcher change the owner hasn't seen.
    const evs = c.penalty_events || [];
    const lastWatcher = [...evs].reverse().find((e) => e.changed_by === "partner");
    if (lastWatcher && (c.lazy_tax_ack_ts || 0) < lastWatcher.ts) {
      base.lazy_tax_update = {
        from: money(lastWatcher.from, c.currency),
        to: money(lastWatcher.amount, c.currency),
      };
    }
  }
  return base;
}

const roleFor = (c, t) => (t && t === c.owner_token ? "owner" : t && t === c.partner_token ? "partner" : null);

const CAP = 30; // free challenge is 30 days; Secret Mode removes the cap
function hardcoreTier(streak) {
  if (streak >= 365) return { name: "Lifetime Discipline", emoji: "🔥", next: null };
  if (streak >= 100) return { name: "Legend", emoji: "🔥", next: 365 };
  return { name: "Iron", emoji: "🔥", next: 100 };
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const store = globalThis.__PP_STORE__ || getStore("challenges");

  try {
    // ---- create -------------------------------------------------------
    if (action === "create") {
      const b = await req.json().catch(() => ({}));
      const currency = clean(b.currency, 3) || "$";
      const owner_name = clean(b.owner_name, MAX_NAME) || "You";
      const partner_name = clean(b.partner_name, MAX_NAME) || "Your partner";
      let target = Math.round(Number(b.daily_target));
      if (!Number.isFinite(target)) target = 10;
      target = Math.min(1000, Math.max(1, target));
      let penalty = Math.round(Number(b.penalty_amount));
      if (!Number.isFinite(penalty)) penalty = currency === "Rp" ? 10000 : 10;
      penalty = Math.min(100000000, Math.max(1, penalty));
      const created_via = b.created_via === "prank" ? "prank" : "self";

      const c = {
        id: newId(),
        owner_name, partner_name,
        daily_target: target,
        penalty_amount: penalty,
        currency,
        created_via,
        owner_token: randomUUID(),
        partner_token: randomUUID(),
        start_date: todaySGT(),
        sessions: {},
        cheers: {},
        penalty_events: [{ amount: penalty, changed_by: "creator", ts: Date.now() }],
        secret_unlocked: false,
        secret_reveal_shown_at: null,
        share_count: 0,
        owner_seen: false,
        partner_first_seen: null,
        created_at: Date.now(),
      };
      await store.setJSON(c.id, c);
      const owner_link = `/c/${c.id}?t=${c.owner_token}`;
      const invite_link = `/c/${c.id}?t=${c.partner_token}`;
      // self: creator is the doer → keep owner_link, send invite_link (profiteer)
      // prank: creator is the profiteer → keep invite_link, send owner_link (the victim/doer)
      return json({
        id: c.id, created_via, owner_link, invite_link,
        keep: created_via === "prank" ? invite_link : owner_link,
        send: created_via === "prank" ? owner_link : invite_link,
      });
    }

    // ---- stats (admin) ------------------------------------------------
    if (action === "stats") {
      const key = url.searchParams.get("key") || "";
      if (!ADMIN_KEY || key !== ADMIN_KEY) return json({ error: "unauthorized" }, 401);
      const { blobs } = await store.list();
      const today = todaySGT();
      let signups = 0, partners = 0, totalSessions = 0, shares = 0, activated = 0, retained2 = 0, retained7 = 0, activeLast7 = 0, pranks = 0;
      const byDay = {}, recent = [];
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (!c || !c.id) continue;
        signups++;
        if (c.created_via === "prank") pranks++;
        if (c.partner_first_seen) partners++;
        shares += Number(c.share_count || 0);
        const days = Object.keys(c.sessions || {});
        totalSessions += days.length;
        if (days.length >= 1) activated++;
        if (days.length >= 2) retained2++;
        if (days.length >= 7) retained7++;
        if (days.some((d) => (Date.parse(today) - Date.parse(d)) / 86400000 <= 7)) activeLast7++;
        const day = c.start_date || (c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "?");
        byDay[day] = (byDay[day] || 0) + 1;
        const m = compute(c);
        recent.push({ id: c.id, owner: c.owner_name, partner: c.partner_name, target: c.daily_target,
          penalty: c.penalty_amount, currency: c.currency, via: c.created_via, streak: m.streak,
          sessions: days.length, missed: m.missed_count, earned: m.partner_earned, shares: c.share_count || 0,
          partner_joined: !!c.partner_first_seen, created: c.created_at || 0 });
      }
      recent.sort((a, b) => (b.created || 0) - (a.created || 0));
      const series = [];
      for (let i = 29; i >= 0; i--) { const d = new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10); series.push({ date: d, count: byDay[d] || 0 }); }
      return json({
        totals: {
          signups, pranks, partners_joined: partners, total_sessions: totalSessions, shares,
          activated, active_last_7d: activeLast7,
          retention_2d: signups ? +(retained2 / signups * 100).toFixed(1) : 0,
          retention_7d: signups ? +(retained7 / signups * 100).toFixed(1) : 0,
          activation_rate: signups ? +(activated / signups * 100).toFixed(1) : 0,
          partner_join_rate: signups ? +(partners / signups * 100).toFixed(1) : 0,
        },
        signups_by_day: series, recent: recent.slice(0, 60),
      });
    }

    // All other actions need a challenge + token.
    const id = url.searchParams.get("id") || "";
    const token = url.searchParams.get("t") || "";
    if (!id) return json({ error: "missing id" }, 400);
    const c = await store.get(id, { type: "json" });
    if (!c) return json({ error: "not found" }, 404);
    const role = roleFor(c, token);
    if (!role) return json({ error: "invalid link" }, 403);

    // ---- get ----------------------------------------------------------
    if (action === "get") {
      if (role === "partner" && !c.partner_first_seen) { c.partner_first_seen = Date.now(); await store.setJSON(id, c); }
      return json(view(c, role));
    }

    // ---- accept (the watcher joins the game) -------------------------
    if (action === "accept") {
      if (role !== "partner") return json({ error: "only the watcher can accept" }, 403);
      if (!c.partner_accepted) { c.partner_accepted = Date.now(); c.partner_first_seen = c.partner_first_seen || Date.now(); await store.setJSON(id, c); }
      return json(view(c, role));
    }

    // ---- lazy_tax_ack (owner dismisses the "wife raised it" banner) --
    if (action === "lazy_tax_ack") {
      if (role !== "owner") return json({ error: "owner only" }, 403);
      c.lazy_tax_ack_ts = Date.now();
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- secret_seen (the Day-19 reveal is one-time: burn it on view) --
    if (action === "secret_seen") {
      if (role !== "owner") return json({ error: "owner only" }, 403);
      if (!c.secret_reveal_shown_at) { c.secret_reveal_shown_at = Date.now(); await store.setJSON(id, c); }
      return json(view(c, role));
    }

    // ---- unlock_secret (enter Secret Mode — free, removes the 30-day cap) --
    if (action === "unlock_secret") {
      if (role !== "owner") return json({ error: "owner only" }, 403);
      c.secret_unlocked = true;
      c.secret_reveal_shown_at = c.secret_reveal_shown_at || Date.now();
      c.secret_unlocked_at = Date.now();
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- session (owner/doer saves a completed push-up session) -------
    if (action === "session") {
      if (role !== "owner") return json({ error: "only the challenger does the push-ups" }, 403);
      const b = await req.json().catch(() => ({}));
      let reps = Math.round(Number(b.reps)); if (!Number.isFinite(reps) || reps < 0) reps = 0;
      reps = Math.min(100000, reps);
      let dur = Math.round(Number(b.duration_seconds)); if (!Number.isFinite(dur) || dur < 0) dur = 0;
      const today = todaySGT();
      c.sessions = c.sessions || {};
      const prev = c.sessions[today];
      // keep the best effort of the day
      if (!prev || reps >= prev.reps) {
        c.sessions[today] = { reps, target: c.daily_target, started_at: Number(b.started_at) || Date.now(), ended_at: Date.now(), duration_seconds: dur };
      }
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- penalty (partner/profiteer raises the stakes) ---------------
    if (action === "penalty") {
      if (role !== "partner") return json({ error: "only your partner can change the penalty" }, 403);
      const b = await req.json().catch(() => ({}));
      let amt = Math.round(Number(b.amount));
      if (!Number.isFinite(amt)) return json({ error: "bad amount" }, 400);
      amt = Math.min(100000000, Math.max(1, amt));
      const from = c.penalty_amount;
      c.penalty_amount = amt;
      c.penalty_events = c.penalty_events || [];
      c.penalty_events.push({ amount: amt, from, changed_by: "partner", ts: Date.now() });
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- cheer (emoji reaction, mostly the partner) ------------------
    if (action === "cheer") {
      const b = await req.json().catch(() => ({}));
      const emoji = clean(b.emoji, 8);
      if (!emoji) return json({ error: "no emoji" }, 400);
      const today = todaySGT();
      c.cheers = c.cheers || {};
      const list = c.cheers[today] || [];
      list.push({ emoji, who: role, ts: Date.now() });
      c.cheers[today] = list.slice(-20);
      await store.setJSON(id, c);
      return json(view(c, role));
    }

    // ---- share (virality signal) -------------------------------------
    if (action === "share") {
      c.share_count = Number(c.share_count || 0) + 1;
      await store.setJSON(id, c);
      return json({ ok: true, shares: c.share_count });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: "server error", detail: String((e && e.message) || e) }, 500);
  }
};
