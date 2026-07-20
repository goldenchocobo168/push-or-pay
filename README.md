# 🏋️ Penalty Partner

> Turn your loved ones into your accountability partners. Miss a tiny daily habit and they earn the penalty. The best accountability partner is the one who profits when you fail.

A fun, zero-friction accountability web app. Create a challenge ("1 push-up daily"), set a
penalty, invite your partner with a link. Every day you tap **I did it**. Miss it, your virtual
**debt** to them grows and your **streak** breaks — both of you see the same GitHub-style heatmap
in real time. No login, no real money, just skin in the game.

Built from the ChatGPT product spec, applying Elon's 5-step algorithm: question every
requirement → delete → simplify → speed up → automate. Auto-PayNow was deleted (validate the
behavior first); the debt is a virtual ledger you settle with one tap.

## What it does

- **Create a challenge** — habit + penalty + partner name. No account.
- **Two magic links** — an owner control-panel link, and an invite link for the partner.
- **Daily check-in** — one button. Debt & streak are computed lazily from the check-in history
  in Singapore time, so there is **no midnight cron**: a missed day is simply any past day with
  no check-in, after the last settlement.
- **Heatmap** — last 90 days, done / missed / forgiven / today. Both roles see it live.
- **Partner powers** — cheer with emoji reactions, or **forgive** a day (mercy button).
- **Settle** — "mark as paid" resets the ledger.
- **Share card** — a screenshot-able streak card ("I owe my wife $60 for skipping 6 push-ups").
- **Analytics** — `/admin` (admin-key gated) shows real signups, activation, retention, usage,
  and shares, derived live from stored challenges.

## Architecture

Static frontend + one Netlify Function (v2) + **Netlify Blobs** for shared state. No external
database, no build step for the frontend, no background jobs.

```
public/            static frontend (no build)
  index.html       landing + create challenge
  challenge.html   owner/partner view (loaded by app.js)
  admin.html       analytics dashboard
  app.js  style.css
lib/penalty.mjs    pure, dependency-free debt/streak/heatmap logic (unit-tested)
netlify/functions/api.js   the whole API (?action=create|get|checkin|forgive|settle|share|stats)
test/              node assertions: logic (27) + handler E2E (29)
```

## Data model (one Blobs entry per challenge)

```
id, owner_name, partner_name, habit, penalty, currency,
owner_token, partner_token,          # role = which token you hold
start_date, checkins{date:ts}, forgiven{date:ts},
settled_through, settlements[], share_count, partner_first_seen, reactions{date:[]}
```

## Run tests

```
npm install
npm test
```

## Deploy

```
netlify deploy --prod
# set the admin key once:
netlify env:set PP_ADMIN_KEY <a-strong-key>
```

Analytics: `https://<site>/admin` → enter `PP_ADMIN_KEY`.

## Ownership

This product is owned end-to-end by an autonomous **Tibo DRI loop** (`dri/`), which observes
real metrics, calibrates on the deliverable, decides the next highest-leverage move, and ships —
escalating only the hard gates (real money, prod infra, bulk deletes, mission pivots).
