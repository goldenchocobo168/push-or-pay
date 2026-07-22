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
spouse? Static frontend, one Netlify function, Netlify Blobs for state, no build step, no DB.

https://pushorpay.netlify.app

Curious what other couples-accountability mechanics people have tried that actually stuck
(vs the usual habit-tracker that gets abandoned in a week).

## Reddit (r/SideProject / r/InternetIsBeautiful — pick whichever's mood fits that week)
**Title:** My wife earns money every time I skip my push-ups (built this as a joke, it actually works)

**Body:**
Built a tiny web app: you set a daily push-up streak, pick a partner, and if you miss a day
they get a (virtual) penalty payout and a screen that says something like "your wife earned
$10 today, congrats on your laziness." She gets to cheer, heckle, or raise the stakes.

Not trying to build a habit-tracker SaaS, genuinely just wanted something funny enough that
people would send the screenshot to their partner unprompted. Free, no signup wall beyond
picking a name. Would love brutally honest feedback on whether the joke lands or falls flat.

https://pushorpay.netlify.app

## Notes for whoever (Tibo, future cycle) posts these
- Swap "wife" framing per-post if the sub skews differently (copy.json already has
  gender-neutral variants — pull from there, don't hardcode).
- Track referrer via existing UTM-free approach: recent[] created_via field already
  distinguishes self/prank; if referral tracking matters later, that's a new issue, not
  a blocker to a first post.
- One post, one channel, per cycle — don't batch-post everywhere at once (can't attribute
  which channel worked, and repeat self-promotion across subs same day reads as spam).
