// Pure, dependency-free accountability logic.
// Debt and streak are computed lazily from the check-in history + "today",
// so there is no midnight cron: a missed day is simply any past day (before
// today, on/after start, after the last settlement) with no check-in.

export const SGT = "Asia/Singapore";

// "YYYY-MM-DD" for the given instant in Singapore time.
export function todaySGT(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SGT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Parse "YYYY-MM-DD" to a UTC-noon Date (noon avoids any TZ/DST edge drift).
export function parseDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function fmtDay(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(s, n) {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}

// Whole days from a -> b (b later => positive).
export function diffDays(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

// Status of a single day given the challenge state.
export function dayStatus(c, date, today) {
  const start = c.start_date;
  const settled = c.settled_through || addDays(start, -1);
  if (diffDays(start, date) < 0 || diffDays(date, today) < 0) return "empty";
  if (c.checkins && c.checkins[date]) return "done";
  if (c.forgiven && c.forgiven[date]) return "forgiven";
  if (date === today) return "today"; // pending, not a miss yet
  if (diffDays(settled, date) <= 0) return "settled"; // already paid off
  return "missed";
}

// Compute debt, streak, counts and the last-90-day heatmap.
export function compute(c, today = todaySGT()) {
  const checkins = c.checkins || {};
  const forgiven = c.forgiven || {};
  const start = c.start_date;

  // Missed days -> debt.
  let missed = 0;
  let doneTotal = 0;
  for (let d = start; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    const st = dayStatus(c, d, today);
    if (st === "missed") missed++;
    if (st === "done") doneTotal++;
  }
  const debt = missed * Number(c.penalty || 0);

  // Current streak: walk back from today (or yesterday if today not done yet).
  // Forgiven days are skipped (neither break nor extend); a real miss breaks it.
  let streak = 0;
  let cur = checkins[today] ? today : addDays(today, -1);
  while (diffDays(start, cur) >= 0) {
    if (checkins[cur]) {
      streak++;
      cur = addDays(cur, -1);
    } else if (forgiven[cur]) {
      cur = addDays(cur, -1);
    } else {
      break;
    }
  }

  // 90-day heatmap ending today (GitHub-style).
  const heat = [];
  for (let i = 89; i >= 0; i--) {
    const date = addDays(today, -i);
    heat.push({ date, status: dayStatus(c, date, today) });
  }

  return {
    today,
    today_done: !!checkins[today],
    streak,
    debt,
    missed_count: missed,
    done_total: doneTotal,
    heat,
  };
}

// Playful, deterministic roast line (indexed by missed count so it is stable
// within a day). Kept gentle per the "make failure funny" brief.
const ROASTS = [
  "Clean slate. No debt, no drama. Keep it that way. 💪",
  "One slip. Everyone gets one. Don't make it a habit. 👀",
  "Two misses. Your partner is starting to like this app. 😏",
  "The streak is bruised but breathing. Prove it wasn't a fluke. 🔥",
  "Your wallet is now a motivational tool. Use it. 💸",
  "At this rate your partner is funding date night off your excuses. 🍜",
  "The gym misses you. Your bank account misses you more. 🏋️",
  "Momentum is a muscle too. Start rebuilding it today. 🧱",
];
export function roast(missed) {
  return ROASTS[Math.min(missed, ROASTS.length - 1)];
}

// Celebration copy for a live streak.
export function cheer(streak) {
  if (streak >= 100) return "💯 A hundred days. You're a machine.";
  if (streak >= 30) return "🏆 30-day streak. This is who you are now.";
  if (streak >= 7) return "🔥 A full week. Momentum unlocked.";
  if (streak >= 3) return "🌱 Three in a row. It's becoming a habit.";
  if (streak >= 1) return "✅ On the board. Don't break it.";
  return "Start today. One tiny rep.";
}
