# Show HN: Push or Pay - Accountability app where your partner profits when you fail

**Why it exists:** After deleting my 5th habit app for feeling guilty about missed days, I realized what actually kept me going wasn't streaks—it was my wife joking "Ooh, you're slacking, I'm up to $60 in bubble tea money this month." So I built that.

**How it works:**
- You set 10 push-ups/day + $5 penalty per miss
- Your partner gets a "watcher view"—they see your streak live
- When YOU skip, THEY earn the penalty (virtual, but tracked)
- Shareable moment: "😭 my husband missed 3 days, I'm up $15"

The core mechanic: **your partner is the "lovable final boss"—they're not nagging, they're earning bubble tea money when you slack.**

**Tech:** Vanilla JS frontend, Vercel Functions, Upstash Redis. No build step, no external DB.

**Live metrics (25 signups, learning phase):**
- 16% activation rate (down from 19% - learning that traffic quality matters)
- 12% 2-day retention (still optimizing)
- 4% partner join rate (working on this)
- 1 share action (someone sent a screenshot to their spouse—the "would-send-to-spouse" test)

**What I've learned since Product Hunt:**
- Volume ≠ quality: 15 signups in one day from PH discovery, but 0% became active pairs
- Curiosity signups ("fun app") don't convert like accountability-seekers
- The partner-earning mechanic is the real differentiator - it creates genuine two-player accountability

**What I avoided:**
- ❌ Guilt-based messaging ("you failed") → "Someone just earned bubble tea 🧋"
- ❌ Generic dashboards → Your partner IS the dashboard
- ❌ Social shame → It's between you and one person who teases you anyway

**Questions for HN:**
1. Does "your partner profits when you fail" make habit-building more fun or more stressful?
2. Should I lean harder into the "competitive couple" angle, or is the playful framing enough?
3. Anyone successfully used accountability/penalty mechanisms long-term? What actually stuck?
4. How to reach high-intent accountability seekers vs curiosity browsers?

**Live:** https://push-or-pay.vercel.app | **Repo:** github.com/goldenchocobo168/push-or-pay