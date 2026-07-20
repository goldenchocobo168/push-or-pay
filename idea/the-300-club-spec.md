# Push or Pay — The 300 Club (Secret Mode) · SPEC — HOLD (do not build the paid tier yet)

**Status (2026-07-20):** Sam decided **hold the paid 300 Club**; ship the **free Secret Mode**
game mechanic first, validate that people chase streaks, then revisit the paywall. This doc
captures the full idea so nothing is lost. **The $300/mo charge is a real-money gate — Sam's go
only.** Build the paid tier DARK behind a flag when greenlit; never charge until flipped.

## The insight
Turn subscription into a **discovery / reward hunt**, not a paywall. Psychology shifts from
"pay to unlock more" → **"I discovered something hidden."** That's game design, not SaaS.
> Don't make the subscription the secret. Make the subscription the **key**. The secret itself
> must be valuable.

## Free game mechanic (Phase 1 — buildable now, no money)
- Everyone starts on a **30-Day Challenge** (streak caps at 30 — "the app ends at 30").
- **Day 19 reveal (one-time, unique link, never findable again):**
  > 🔒 You found something most people never see. You've reached Day 19. There is a hidden mode.
  > Only disciplined people unlock it. [Enter Secret Mode]
  - Appears ONCE. No obvious upgrade button. Can't be re-found (prevents "make a new account").
- **Secret / Hardcore Mode** = continue beyond 30 days: 🔥 100-Day Iron · 🔥 365-Day Legend ·
  🔥 Lifetime Discipline. (Free in Phase 1 — pure delight; the paywall is Phase 2.)
- Scarcity + mystery + discovery + status, all before any money.

## The 300 Club (Phase 2 — real money, HOLD)
- **300 members · $300/month · one promise.** The number is the *300* movie: grit, sacrifice,
  the elite few who stand when everyone quits. Emotional hook is NOT fitness — *"when everyone
  quits, what are you willing to fight for?"* (Use ORIGINAL Spartan-cinematic art — silhouettes,
  "⚔️ Join The 300" — NOT the copyrighted movie footage.)
- **Cinematic onboarding** (not a pricing page): black screen → "In life, everyone has a limit."
  → "Most stop when it gets hard." → "But some choose to stand." → "The 300 Club is not for
  everyone. Only 300 founding members." → [⚔️ Join The 300].
- **The badge is the product.** Members connect verified socials (X, IG, LinkedIn, TikTok) →
  public profile: "Sam Yap · ⚔️ Founding 300 Member · 247-day streak · Member #087". People flex
  *membership*, not subscriptions (LinkedIn/X bios) → the viral growth loop.
- Requires: Stripe (payments), social OAuth apps, SSO/accounts (identity), the founding-300 cap.

## Viral moment
> "I thought Push or Pay was just a 30-day challenge. Then Day 19 happened."
> — comments: "Wait, what happened on Day 19?" / "How do I unlock?"

## Build phasing
1. **Now (free, reversible):** 30-day cap + Day-19 one-time reveal + Hardcore Mode tiers + the
   cinematic reveal screen. Feature-flagged. No payment, no accounts required.
2. **On Sam's go (real money, dark-behind-flag):** Stripe $300/mo, first-300 cap, cinematic
   Join-The-300, social-verified Founding badge + public profile. Flip live only when Sam says.

Tracked issue: (see repo issues). Related: `idea/flow-v3.md`.
