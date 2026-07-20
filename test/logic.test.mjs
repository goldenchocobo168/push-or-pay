// Plain-node assertions for the pure penalty logic. Run: node test/logic.test.mjs
import assert from "node:assert";
import { compute, addDays, diffDays, dayStatus, todaySGT } from "../lib/penalty.mjs";

let pass = 0;
const ok = (cond, name) => { assert.ok(cond, name); console.log("  ✓", name); pass++; };
const eq = (a, b, name) => { assert.strictEqual(a, b, `${name} (got ${a}, want ${b})`); console.log("  ✓", name); pass++; };

const TODAY = "2026-07-20";
const base = (over = {}) => ({
  penalty: 10, start_date: "2026-07-10", checkins: {}, forgiven: {},
  settled_through: null, ...over,
});

console.log("date helpers");
eq(addDays("2026-07-20", 1), "2026-07-21", "addDays +1");
eq(addDays("2026-07-01", -1), "2026-06-30", "addDays across month");
eq(diffDays("2026-07-10", "2026-07-20"), 10, "diffDays");
ok(/^\d{4}-\d{2}-\d{2}$/.test(todaySGT()), "todaySGT format");

console.log("brand new challenge (start today, no checkins)");
{
  const c = base({ start_date: TODAY });
  const m = compute(c, TODAY);
  eq(m.debt, 0, "no debt on day 0");
  eq(m.streak, 0, "no streak yet");
  eq(m.today_done, false, "today not done");
  eq(m.missed_count, 0, "nothing missed yet (today is pending, not a miss)");
  eq(m.heat.length, 90, "heatmap 90 cells");
  eq(m.heat[89].status, "today", "last heat cell is today");
}

console.log("missed days accrue debt (start 10 days ago, zero checkins)");
{
  const c = base({ start_date: "2026-07-10" });
  const m = compute(c, TODAY);
  // days 07-10..07-19 missed (10 days), 07-20 pending
  eq(m.missed_count, 10, "10 missed days");
  eq(m.debt, 100, "debt = 10 misses * $10");
  eq(m.streak, 0, "streak 0");
}

console.log("perfect streak");
{
  const checkins = {};
  for (let d = "2026-07-10"; diffDays(d, TODAY) >= 0; d = addDays(d, 1)) checkins[d] = 1;
  const c = base({ checkins });
  const m = compute(c, TODAY);
  eq(m.debt, 0, "no debt when all done");
  eq(m.streak, 11, "streak counts today back to start (11 days incl today)");
  eq(m.today_done, true, "today done");
}

console.log("streak counts from yesterday when today not yet done");
{
  const checkins = {};
  for (let d = "2026-07-10"; diffDays(d, "2026-07-19") >= 0; d = addDays(d, 1)) checkins[d] = 1;
  const c = base({ checkins }); // done through yesterday, not today
  const m = compute(c, TODAY);
  eq(m.streak, 10, "streak 10 (yday back to start), today still open");
  eq(m.today_done, false, "today open");
  eq(m.missed_count, 0, "today pending is not a miss");
}

console.log("a real miss breaks the streak");
{
  const checkins = { "2026-07-18": 1, "2026-07-19": 1, "2026-07-20": 1 }; // 07-17 and earlier missed
  const c = base({ checkins });
  const m = compute(c, TODAY);
  eq(m.streak, 3, "streak only counts back to the gap");
  eq(m.missed_count, 8, "07-10..07-17 missed = 8 days");
  eq(m.debt, 80, "debt 80");
}

console.log("forgiven day does not break streak nor add debt");
{
  const checkins = { "2026-07-18": 1, "2026-07-20": 1 };
  const forgiven = { "2026-07-19": 1 };
  const c = base({ checkins, forgiven });
  const m = compute(c, TODAY);
  eq(dayStatus(c, "2026-07-19", TODAY), "forgiven", "07-19 forgiven");
  eq(m.streak, 2, "streak spans the forgiven gap (18 + 20, 19 skipped)");
  ok(!m.heat.some((x) => x.date === "2026-07-19" && x.status === "missed"), "forgiven not counted missed");
}

console.log("settlement zeroes prior debt");
{
  const c = base({ start_date: "2026-07-10", settled_through: TODAY });
  const m = compute(c, TODAY);
  eq(m.debt, 0, "all prior misses settled");
  eq(m.missed_count, 0, "no active misses after settle");
}

console.log(`\nAll ${pass} assertions passed ✅`);
