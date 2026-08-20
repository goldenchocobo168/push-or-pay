# Landing Hook A/B Test Plan - Relationship Frame vs Curiosity Frame

## Problem
Current hero hook "Who profits when you skip?" drives signups but 76% never start first session. Curiosity frame attracts passive browsers, not committed habit-builders.

## Hypothesis
A relationship-focused hook ("The tiny game that saves relationships") will attract users with stronger partner bonds, leading to higher activation and partner-join rates.

## Test Variants

**Control (Variant A - Current):**
Hook: "Who profits when you skip?"
Subhead: "A funny game you play with your partner."

**Test (Variant B - Relationship Frame):**
Hook: "The tiny game that saves relationships"
Subhead: "Not a fitness app. A relationship game where one protects their streak, the other gets excited when they fail."

## Implementation

### 1. Add Hook Variant Tracking
```javascript
// In challenge creation, track which hook variant led to signup
"hook_variant": 0  // 0 = control, 1 = relationship frame
```

### 2. URL Param Implementation
`/?h=relationship` serves Variant B
Default or `/?h=curiosity` serves Variant A

### 3. Hero Component Update
```jsx
// Update landing page hero to serve variant based on URL param
const hookVariant = searchParams.get('h') === 'relationship' ? 1 : 0;
const hookText = hookVariant === 1 ?
  "The tiny game that saves relationships" :
  "Who profits when you skip?";
```

### 4. Stats Endpoint Addition
Track signups_by_hook_variant:
```json
{
  "signups_by_hook_variant": {
    "0": 15,  // control
    "1": 6    // relationship frame
  },
  "activation_by_hook_variant": {
    "0": 0.19,
    "1": 0.35
  },
  "partner_join_by_hook_variant": {
    "0": 0.048,
    "1": 0.10
  }
}
```

## Success Criteria
- Graduate if relationship variant shows 2× activation (A: 19% → B: 38%+)
- Graduate if partner join rate doubles (A: 4.8% → B: 9.6%+)
- Run for minimum 48 hours or 50 signups per variant
- Rollback if activation drops below 15% for 24h

## Deployment Plan (SHIP=1)
1. Create branch `feat/landing-hook-ab-test`
2. Implement variant tracking + URL param serving
3. Update hero component with conditional copy
4. Add stats tracking
5. Deploy via `dri/deploy.sh`
6. Run `npm test` (must be green)
7. Verify live with both URL params
8. Monitor for 48h minimum

## Expected Effects
- Activation rate: 19% → 35%+ (clearer relationship frame → clearer commitment)
- Partner join rate: 4.8% → 10%+ (relationship-focused users more likely to invite actual partners)
- Higher-quality signups: users seeking relationship bonding vs passive curiosity

## Calibration Learning
This test determines if the binding constraint is traffic quality (wrong frame attracts wrong users) or onboarding design (right users but broken first-session experience). If relationship frame improves activation, the problem is positioning. If both variants stay below 25% activation, the problem is onboarding flow itself (requires Day-0 nudge deployment from feat/push-prompt-optimization branch).