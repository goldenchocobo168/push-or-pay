# 💪 Push or Pay

> **Not a fitness app. A tiny game between two people.** One person protects their streak — the
> other gets a little too excited when they fail. The streak is the hero, the penalty is the joke,
> the relationship is the product. *Who profits when you fail?*

Do your tiny daily habit (push-ups) and protect your **streak**. Miss it, and your partner —
the lovable final boss — **profits** (a virtual penalty) and gets to cheer, heckle, or *raise the
stakes*. Built to make couples **laugh while building habits together**. The most important
metric: *"would someone send this screenshot to their spouse?"*

<p align="center"><img src="docs/screenshot-partner-view.png" width="380" alt="Partner's watcher view: 'E2E Sam did today's push-ups. You earn nothing 😑'"></p>

*The partner's view when the streak survives — the schadenfreude moment this whole app is built around.*

Built from the product spec in [`idea/Push or Pay idea.pdf`](idea/), Elon-5P applied (real PayNow
transfer is explicitly **not** built — validate the funny behavior first).

## Live
- App: **https://push-or-pay.vercel.app** (migrated off Netlify 2026-08-08, PR #99; old
  `pushorpay.netlify.app` now 301-redirects here, kept alive for distributed links)
- Analytics (admin-gated): **/admin** — signups, pranks, push-up sessions, retention, shares.
- Repo: **github.com/goldenchocobo168/push-or-pay**

## What it does (the brand rules)
1. **Never guilt.** Not "you failed" — *"Someone just earned bubble tea 🧋."*
2. **Always a little funny.** Every screen has a joke (static copy in `public/copy.json`, no AI).
3. **The partner is the lovable final boss** — *"Your wife is watching 👀."*

- **Onboarding**: hook → **self or prank** mode → a funny warning gate → *Your promise* → invite
  ("give your partner the power 😈").
- **Prank / reverse flow**: set a challenge up *for* someone and send it — they get a
  *"X challenged you!"* alert.
- **IDR sticker-shock gag**: default `Rp 10,000` reads huge, then deflates to *≈ US$0.64* 😏.
- **Push-up session**: put the phone down, tap the big button per rep (chin/finger), live counter
  + timer + overachievement **bonus** + confetti. A day counts when a session hits the target.
- **Streak = hero** (GitHub-style 90-day heatmap, both sides see it live). Partner can **cheer**
  and **raise the penalty** (2× / 5× / custom).
- **Shareable card** ("😭 my wife earned $60 this week").

## Architecture
Static frontend + **Vercel Functions** (`api/`) + **Upstash Redis** (shared state, moved off
Netlify Blobs in the same migration). No external DB, no build step, **no cron** for app logic
(streak/earnings computed lazily in SGT; a Vercel cron does daily push reminders). One Redis entry
per challenge: `owner`(doer)/`partner`(profiteer) magic-link tokens, `daily_target`,
`penalty_amount`, `currency`, `sessions{date:{reps,duration,…}}`, `penalty_events`, `cheers`,
`created_via`.

```
public/            static frontend (no build): index (onboarding), challenge (app), admin, copy.json
lib/penalty.mjs    pure streak/earnings/heatmap + money/IDR logic (unit-tested)
lib/store.mjs      Upstash Redis client wrapper (get/setJSON/list)
api/index.js       ?action=create|get|session|penalty|cheer|share|stats
api/send-reminders.js   daily push-reminder cron handler
dri/               autonomous Tibo DRI (owns the product) — see below
design/            top-1% UI/UX inspiration gallery
test/              logic + handler + send-reminders assertions + real-browser CDP E2E
```

## Run tests
```
npm install && npm test          # logic + handler + send-reminders assertions
python3 test/browser_e2e.py      # real-browser end-to-end (needs Chrome on :9222)
```

## Deploy
`vercel deploy --prod` directly is discouraged — use the gated wrapper (tests, live-tree check,
verify):
```
dri/deploy.sh                    # npm test -> vercel deploy --prod -> verify live
vercel env add PP_ADMIN_KEY      # for /admin
```

## Ownership — the Tibo DRI
Owned end-to-end by an autonomous **Tibo DRI** (`dri/`, hourly systemd timer, shadow-first
`PP_DRI_SHIP=0`). North Star = **SHARED** ("would-send-to-spouse") + **ACTIVE-PAIRS**. It observes
real metrics, calibrates, decides the next move, and ships — escalating only real-money / infra /
bulk-delete / mission-pivot. Kill switch: `systemctl disable --now push-or-pay-rsi.timer`.
Graduate to autonomous shipping: set `PP_DRI_SHIP=1` in `push-or-pay-rsi.service` + `daemon-reload`.

## Design
Follows the fleet design baseline (`~/.openclaw/shared/distilled/concepts/design-baseline.md`,
Apple-grade, techno-futurist lane). Inspiration gallery: `design/ui-ux-inspiration.md`.
