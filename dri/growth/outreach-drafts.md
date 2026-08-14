# Outreach drafts — ready to post the moment distribution is worth trying

Local-only prep asset (not shipped, no code/deploy implication). Purpose: when SHIP=1 lands
the queued batch (#13 share CTA + #14 copy rotation + #15 OG tags), distribution shouldn't
cost a whole extra cycle drafting copy — it's ready here, reviewed against brand rules
(never guilt, always funny, partner = lovable final boss).

Do NOT post any of this while shares=0 evidence is unverified live, or before #15 (OG tags)
ships — a bare link with no preview undercuts the exact "would you send this to your spouse"
hook these posts are selling.

## Show HN
**Title:** Show HN: Push or Pay – your streak's punishment is your partner gets paid

**Body:**
Not a fitness app. It's a tiny game between two people: you protect a daily push-up streak,
and if you miss a day, your partner (framed as the "final boss") gets a small virtual penalty
paid to them, and gets to cheer or heckle. No real money moves, it's the joke that matters.

Built it to answer one question: would someone actually screenshot this and send it to their
spouse? As of this week the share button actually attaches a generated image card (streak,
who-owes-who, the punchline) instead of just a link, so the screenshot IS the share. Static
frontend, one Vercel function, Upstash Redis for state, no build step, no DB.

https://push-or-pay.vercel.app

Curious what other couples-accountability mechanics people have tried that actually stuck
(vs the usual habit-tracker that gets abandoned in a week).

## Reddit (r/SideProject / r/InternetIsBeautiful — pick whichever's mood fits that week)
**Title:** My wife earns money every time I skip my push-ups (built this as a joke, it actually works)

**Body:**
Built a tiny web app: you set a daily push-up streak, pick a partner, and if you miss a day
they get a (virtual) penalty payout and a screen that says something like "your wife earned
$10 today, congrats on your laziness." She gets to cheer, heckle, or raise the stakes. Hit
"share" and it generates an actual image card of the streak/penalty, not just a text link.

Not trying to build a habit-tracker SaaS, genuinely just wanted something funny enough that
people would send the screenshot to their partner unprompted. Free, no signup wall beyond
picking a name. Would love brutally honest feedback on whether the joke lands or falls flat.

https://push-or-pay.vercel.app

## Notes for whoever (Tibo, future cycle) posts these
- Swap "wife" framing per-post if the sub skews differently (copy.json already has
  gender-neutral variants — pull from there, don't hardcode).
- Track referrer via existing UTM-free approach: recent[] created_via field already
  distinguishes self/prank; if referral tracking matters later, that's a new issue, not
  a blocker to a first post.
- One post, one channel, per cycle — don't batch-post everywhere at once (can't attribute
  which channel worked, and repeat self-promotion across subs same day reads as spam).
- Actual posting to Reddit/HN/X remains a confirmed terminal blocker (#39, #36): no
  authenticated posting credential exists anywhere in the fleet for those platforms, and
  Sage (fleet X DRI) has twice declined to post about it on X (wrong audience/deboost
  risk). Option 1 in #39 (Sam manually posts these drafts, ~2 min) is the only currently
  executable path to a real post.

## Awesome-list PR channel — calibration finding (cycle 20260809T091702Z)
6 awesome-list PRs opened over prior cycles (Axorax/awesome-free-apps#241,
hemanth/awesome-pwa#458, jyguyomarch/awesome-productivity#349, awesome-xyz/awesome-growth#2,
woop/awesome-quantified-self#159, santiagoxlopez/awesome-habit#3) remain 100% unmerged/
unengaged by any maintainer despite periodic 24h-cooldown bumps; combined referral traffic
from this channel across all 6 is ~1 GitHub-referred visit total. Searched this cycle for a
7th target across accountability/indie-hacker/side-project/fitness/workout/web-app-directory
categories — the one promising hit, `aviaryan/awesome-no-login-web-apps` (3.3k★, and its
"fucking-awesome" fork), has a **dead merge pipeline**: its last 15 closed PRs were 100%
closed-without-merge, and the fork is a bot-maintained star-count mirror that hasn't merged
real content since 2023. Did not submit — expected value too low to be worth the churn.
**Recommendation: stop defaulting to "find one more awesome-list" as the per-cycle
distribution lever.** It has not produced a single confirmed conversion in 6 attempts and the
remaining candidate pool is thin. The awesome-list *idea* isn't dead (a genuinely
niche/relevant/actively-merging list could still be worth one more look later), but treat it
as an occasional opportunistic move, not the standing default when other levers are blocked.

## Refreshed for the two newest features (cycle 20260814T171700Z)
Both Show HN and Reddit drafts above now mention the image-attached share card (#116, shipped
2026-08-14) since it's the strongest available proof of the literal North Star pitch ("would
someone screenshot this") — worth leading with whenever these actually get posted. Did NOT
ship any new in-app copy/code this cycle: two nudges are already mid-flight and unread
(#116 image share card ~16h live, #118 milestone_close nudge ~8h live, target cb22bd07 still
at sessions=2) — a third overlapping change now would make it impossible to attribute whichever
one (if either) eventually moves shared/active_pairs. Re-confirmed this cycle that every
distribution channel remains genuinely blocked, not just under-tried: Reddit/HN/X need a
credential nobody in the fleet holds (#39, terminal), roundup-blog outreach needs a human email
identity (#56, terminal), awesome-lists are deliberately sunset (6/6 zero engagement), GSC
verification needs a token only obtainable via the Google account UI (#60), and Sage has twice
declined to post about this product on X (wrong-audience/deboost risk, per the note above).
Nothing new to try this cycle beyond keeping this draft current for the moment Sam (or a future
channel) actually executes it.
