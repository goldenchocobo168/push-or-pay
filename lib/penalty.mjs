// Pure, dependency-free logic for Push or Pay.
// The streak is the hero; the penalty is the joke. A day is DONE when a
// completed push-up session hit that day's target. Missed days (past days with
// no qualifying session) are what the partner "earns" on. Computed lazily in
// SGT — no midnight cron.

export const SGT = "Asia/Singapore";

// Approximate USD value of one unit of each currency — ONLY used for the
// IDR sticker-shock joke ("Rp 10,000 … ≈ US$0.64 😏"). Not financial truth.
export const USD_PER = { "$": 1, "US$": 1, "S$": 0.74, "£": 1.27, "€": 1.08, "₹": 0.012, "Rp": 0.000064 };

export function todaySGT(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SGT, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function parseDay(s) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); }
export function fmtDay(d) { return d.toISOString().slice(0, 10); }
export function addDays(s, n) { const d = parseDay(s); d.setUTCDate(d.getUTCDate() + n); return fmtDay(d); }
export function diffDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }

// A day counts as done when a completed session reached that day's target.
export function isDone(c, date) {
  const s = (c.sessions || {})[date];
  return !!(s && s.reps >= (s.target || c.daily_target || 1));
}

export function dayStatus(c, date, today) {
  if (diffDays(c.start_date, date) < 0 || diffDays(date, today) < 0) return "empty";
  if (isDone(c, date)) return "done";
  if (date === today) return "today"; // pending, not a miss yet
  return "missed";
}

// Format a money amount with its currency (Rp gets thousands separators for
// maximum sticker shock).
export function money(amount, currency = "$") {
  const cur = currency || "$";
  const sep = cur === "Rp" ? " " : "";
  const n = cur === "Rp" ? Number(amount).toLocaleString("en-US") : amount;
  return `${cur}${sep}${n}`;
}
// The joke: the approx USD value, revealed a beat after the big number.
export function usdHint(amount, currency = "$") {
  const rate = USD_PER[currency];
  if (!rate || currency === "$" || currency === "US$") return null;
  const usd = amount * rate;
  return usd < 1 ? `US$${usd.toFixed(2)}` : `US$${usd.toFixed(usd < 10 ? 1 : 0)}`;
}

export function compute(c, today = todaySGT()) {
  const start = c.start_date;
  const penalty = Number(c.penalty_amount || 0);

  let missed = 0, doneTotal = 0, weekMissed = 0, weekDone = 0;
  for (let d = start; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    const st = dayStatus(c, d, today);
    const inWeek = diffDays(d, today) <= 6;
    if (st === "missed") { missed++; if (inWeek) weekMissed++; }
    if (st === "done") { doneTotal++; if (inWeek) weekDone++; }
  }

  // Streak: consecutive done days back from today (or yesterday if today open).
  let streak = 0;
  let cur = isDone(c, today) ? today : addDays(today, -1);
  while (diffDays(start, cur) >= 0) {
    if (isDone(c, cur)) { streak++; cur = addDays(cur, -1); } else break;
  }

  // 90-day heatmap ending today.
  const heat = [];
  for (let i = 89; i >= 0; i--) {
    const date = addDays(today, -i);
    heat.push({ date, status: dayStatus(c, date, today) });
  }

  const todaySession = (c.sessions || {})[today] || null;
  return {
    today,
    daily_target: c.daily_target || 10,
    today_reps: todaySession ? todaySession.reps : 0,
    today_done: isDone(c, today),
    streak,
    missed_count: missed,
    done_total: doneTotal,
    partner_earned: missed * penalty,
    week_earned: weekMissed * penalty,
    week_done: weekDone,
    week_missed: weekMissed,
    penalty_amount: penalty,
    currency: c.currency || "$",
    heat,
  };
}

// Deterministic pick from a copy array (stable within a day / by seed).
export function pick(arr, seed = 0) {
  if (!arr || !arr.length) return "";
  return arr[Math.abs(Math.trunc(seed)) % arr.length];
}
