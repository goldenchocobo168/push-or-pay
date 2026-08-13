// One-time maintenance: pre-#41 (2026-07-24T01:19:57Z) challenge rows were
// created before is_test tagging existed, so dev/build-time verification rows
// (E2E Sam, MonitorBot, VerifyRealUser, PersistTest, Persist3, Victim/Prankster,
// You/Your partner defaults, and clustered duplicate Sam/Wife rows all created
// within a ~2h window on 2026-07-20 during initial build) have been silently
// counted as real signups/partners/sessions in every `action=stats` read since.
// This backfills is_test=true on an EXPLICIT id allowlist only — never a name
// heuristic at write time — so a real user is never misclassified.
// Usage: node dri/scripts/backfill-is-test.mjs           (dry run, default)
//        node dri/scripts/backfill-is-test.mjs --apply    (writes)
import { getStore } from "../../lib/store.mjs";

const APPLY = process.argv.includes("--apply");

// Explicit allowlist, hand-verified against created_at + owner/partner name
// for every one of the 28 rows counted in the 2026-08-12 stats snapshot.
const TEST_IDS = [
  "0931fdca", // You / Your partner — the DRI's own persisted self-heal scratch challenge
  "985a14a5", // MonitorBot / MonitorPartner
  "cfc0808e", // E2E Sam / E2E Wife
  "d4f6591e", // E2E Sam / E2E Wife
  "ee532843", // You / Your partner
  "ab6eb889", // Sam / Wife (07-20 build-session cluster)
  "2dd93029", // Sam / Wife (07-20 build-session cluster)
  "7e266b48", // Persist3 / W
  "647fa962", // E2E Sam / E2E Wife
  "c859bd61", // Victim / Prankster
  "49f59466", // E2E Sam / E2E Wife
  "03395d7a", // Sam / Wife (07-20 build-session cluster)
  "5592b65a", // Sam / Wife (07-20 build-session cluster)
  "04a8cf7d", // Sam / Wife (07-20 build-session cluster)
  "81e2e4d8", // sam / wife (07-20 build-session cluster)
  "609d4dd0", // PersistTest / W
  "61dc5403", // Victim / Prankster
  "6967245b", // E2E Sam / E2E Wife
  "57f92e8e", // Husband / Wife (07-20 build-session cluster)
  "16c3e1b1", // Sam / Wife (07-20 build-session cluster)
  "058dd8ea", // E2E Sam / E2E Wife
  "74b5a686", // Sam / Wife (07-20 build-session cluster)
  "6dc56977", // Sam / Wife (07-20 build-session cluster)
  "76056fc8", // VerifyRealUser / Your partner (created 62s after the #41 fix merged)
];

const store = getStore("challenges");
let changed = 0, skipped = 0, missing = 0;
for (const id of TEST_IDS) {
  const c = await store.get(id);
  if (!c) { console.log(`MISSING ${id} — no row, skipping`); missing++; continue; }
  if (c.is_test) { console.log(`already is_test=true ${id} (${c.owner_name}/${c.partner_name})`); skipped++; continue; }
  console.log(`${APPLY ? "TAGGING" : "WOULD TAG"} ${id} — ${c.owner_name}/${c.partner_name} created ${new Date(c.created_at).toISOString()}`);
  if (APPLY) {
    c.is_test = true;
    await store.setJSON(id, c);
  }
  changed++;
}
console.log(`\n${APPLY ? "Tagged" : "Would tag"} ${changed}, already-tagged ${skipped}, missing ${missing}, total ${TEST_IDS.length}`);
