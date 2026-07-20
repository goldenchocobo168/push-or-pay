// Plain-node assertions for the pure Push or Pay logic. Run: node test/logic.test.mjs
import assert from "node:assert";
import { compute, addDays, diffDays, isDone, dayStatus, money, usdHint, todaySGT } from "../lib/penalty.mjs";

let pass = 0;
const ok = (c, n) => { assert.ok(c, n); console.log("  ✓", n); pass++; };
const eq = (a, b, n) => { assert.strictEqual(a, b, `${n} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); console.log("  ✓", n); pass++; };

const TODAY = "2026-07-20";
const sess = (reps, target = 10) => ({ reps, target });
const base = (over = {}) => ({ penalty_amount: 10, daily_target: 10, currency: "$", start_date: "2026-07-10", sessions: {}, ...over });

console.log("date helpers");
eq(addDays("2026-07-20", 1), "2026-07-21", "addDays +1");
eq(diffDays("2026-07-10", "2026-07-20"), 10, "diffDays");
ok(/^\d{4}-\d{2}-\d{2}$/.test(todaySGT()), "todaySGT format");

console.log("money + IDR sticker-shock joke");
eq(money(10000, "Rp"), "Rp 10,000", "Rp formatted with separators + space");
eq(money(10, "$"), "$10", "USD plain");
eq(usdHint(10000, "Rp"), "US$0.64", "Rp 10,000 ≈ US$0.64 (the joke)");
eq(usdHint(10, "$"), null, "no hint for USD");

console.log("isDone requires reps >= target");
{
  ok(isDone(base({ sessions: { [TODAY]: sess(10) } }), TODAY), "10/10 is done");
  ok(!isDone(base({ sessions: { [TODAY]: sess(4) } }), TODAY), "4/10 not done");
}

console.log("brand new challenge, no sessions");
{
  const m = compute(base({ start_date: TODAY }), TODAY);
  eq(m.partner_earned, 0, "nothing earned day 0");
  eq(m.streak, 0, "no streak");
  eq(m.missed_count, 0, "today pending is not a miss");
  eq(m.heat.length, 90, "heatmap 90 cells");
  eq(m.heat[89].status, "today", "last cell today");
}

console.log("missed days -> partner earns");
{
  const m = compute(base({ start_date: "2026-07-10" }), TODAY);
  eq(m.missed_count, 10, "10 missed");
  eq(m.partner_earned, 100, "10 * $10");
  eq(m.streak, 0, "streak 0");
}

console.log("perfect streak of completed sessions");
{
  const sessions = {};
  for (let d = "2026-07-10"; diffDays(d, TODAY) >= 0; d = addDays(d, 1)) sessions[d] = sess(12);
  const m = compute(base({ sessions }), TODAY);
  eq(m.partner_earned, 0, "no misses");
  eq(m.streak, 11, "streak 11 incl today");
  eq(m.today_done, true, "today done");
  eq(m.today_reps, 12, "today reps 12");
}

console.log("streak counts from yesterday when today open");
{
  const sessions = {};
  for (let d = "2026-07-10"; diffDays(d, "2026-07-19") >= 0; d = addDays(d, 1)) sessions[d] = sess(10);
  const m = compute(base({ sessions }), TODAY);
  eq(m.streak, 10, "streak 10, today still open");
  eq(m.missed_count, 0, "today pending not a miss");
}

console.log("a real miss breaks the streak");
{
  const sessions = { "2026-07-18": sess(10), "2026-07-19": sess(10), "2026-07-20": sess(10) };
  const m = compute(base({ sessions }), TODAY);
  eq(m.streak, 3, "streak back to the gap");
  eq(m.missed_count, 8, "07-10..07-17 missed");
  eq(m.partner_earned, 80, "earned 80");
}

console.log("underachieving session (below target) counts as missed");
{
  const c = base({ start_date: "2026-07-19", sessions: { "2026-07-19": sess(3) } });
  eq(dayStatus(c, "2026-07-19", TODAY), "missed", "3/10 yesterday = missed");
  eq(compute(c, TODAY).streak, 0, "no streak from an under-target day");
}

console.log("weekly earnings window (last 7 days)");
{
  const m = compute(base({ start_date: "2026-06-01" }), TODAY);
  // 7-day window = today..today-6; today is pending (not missed), so 6 missed.
  eq(m.week_missed, 6, "6 missed in the last-7-day window (today still pending)");
  eq(m.week_earned, 60, "week earned 60");
}

console.log(`\nAll ${pass} assertions passed ✅`);
