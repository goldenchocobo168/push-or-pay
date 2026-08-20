# SHADOW PLAN: Multi-Channel High-Intent Distribution Strategy

## Context
- Product Hunt delivered 15 signups with 0 active pairs (catastrophic quality mismatch)
- Reddit distribution blocked (credentials unavailable)
- Current activation cratering: 19% → 16% with MORE signups
- SHARED stuck at 1, ACTIVE-PAIRS stuck at 0
- Need to test multiple channels in parallel to find quality traffic

## Plan for Next SHIP=1 Cycle

### 1. Deploy Onboarding Fix (PR #102 ready)
```bash
git checkout feat/push-prompt-optimization
npm test  # verify green
./dri/deploy.sh
```

**Contains:** Day-0 nudge banner, 6 push_prompt variants, 3 partner-focused invite_hint_v3 variants

**Expected impact:** Activation rate 16% → 40%+, first-session completion from 24% → 60%+

### 2. Execute Multi-Channel Distribution Test

#### Channel A: Hacker News "Show HN" Post
- **Target:** https://news.ycombinator.com/item?id=XXXXX (Show HN submission)
- **Hook:** "Show HN: Push or Pay - The accountability app where your partner earns when you skip"
- **Angle:** Partner-earning mechanic revelation (unique value prop)
- **Community fit:** HN loves accountability systems, quantified self, behavioral economics
- **Expected:** 5-10 high-intent signups, 30%+ activation

#### Channel B: Indie Hackers Product Hunt Discussion
- **Target:** https://www.indiehackers.com/products/push-or-pay
- **Strategy:** Engage existing PH discussion comments with value-add, not promotion
- **Hook:** Share learnings from 0→25 signups, what didn't work (Product Hunt traffic quality)
- **Community fit:** Indie Hackers discusses growth experiments authentically
- **Expected:** 3-5 founder-type signups (high intent), 40%+ activation

#### Channel C: Discord/Slack Accountability Communities
- **Target:** r/habitbuilding Discord, indie hacker Discord communities
- **Strategy:** Participate in accountability threads, share tool only when contextually relevant
- **Hook:** "Building this because existing trackers don't leverage partner accountability"
- **Expected:** 2-3 signups from high-trust communities, 50%+ activation

#### Channel D: Partner-Earning Hook Test on Twitter/X
- **Target:** #accountability #habits #productivity communities
- **Hook variation:** "The app that pays your partner when you fail"
- **Mechanic reveal:** Emphasize partner-earning vs guilt-based punishment
- **Expected:** 5-8 signups, test if partner-earning angle improves partner join rate

### 3. Measurement & Graduation

**Success criteria (48h window):**
- Channel with highest activation rate (>30%) wins
- Graduate winning channel to primary distribution
- Sunset Product Hunt discovery traffic
- If all channels <20% activation, the problem is onboarding (already addressed by feat/push-prompt-optimization deployment)

**Rollback:** If negative feedback >10 upvotes across any channel, delete posts and pivot back to onboarding focus.

## Expected Outcomes

**Baseline (Product Hunt discovery):**
- 25 signups → 0 active pairs
- 16% activation
- 4% partner join rate

**Target (multi-channel test):**
- 10-15 total signups across all channels
- 30%+ activation rate
- 8%+ partner join rate
- 1+ active pair generated

**North Star impact:**
- ACTIVE-PAIRS: 0 → 1+
- SHARED: 1 → 2+ (better engagement → more shares)
- Proves audience quality hypothesis

## Notes

- This is a quality-over-quantity pivot: fewer signups but higher intent
- Partner-earning mechanic is the unique differentiator vs generic accountability apps
- All channels use authentic participation, not spam
- Monitor each channel's quality signals (comments, engagement) not just signup count
