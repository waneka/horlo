---
status: partial
phase: 02-feature-completeness-test-foundation
source: [02-VERIFICATION.md]
started: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. complicationExceptions visual impact
expected: Adding a complication to complicationExceptions causes similarity badges to shift (reduced overlap penalty for watches with that complication)
result: [pending]

### 2. collectionGoal switching
expected: Switching collectionGoal between balanced/specialist/variety-within-theme/brand-loyalist shifts Observations card copy and similarity label thresholds on /insights
result: [pending]

### 3. Good deal badge and section
expected: Wishlist watch with marketPrice <= targetPrice shows "Deal" badge on card; flagged deals appear in Good Deals section on /insights; empty state renders when none flagged
result: [pending]

### 4. Gap-fill badge and callout
expected: Every wishlist/grail card shows a gap-fill badge; detail view shows a gap-fill Card with breakdown by kind (numeric, first-watch, outside-specialty, off-brand, breaks-theme)
result: [pending]

### 5. Days since worn + Sleeping Beauties
expected: Owned watch detail shows "Last worn: {date} (N days ago)" or "Not worn yet"; /insights Sleeping Beauties section lists owned watches unworn >= 30 days
result: [pending]

### 6. Dark mode and mobile
expected: All new surfaces use semantic warm/brass tokens (no raw Tailwind colors); badges readable in dark mode; 375px viewport has 44px+ touch targets and no horizontal overflow
result: [pending]

### 7. isFlaggedDeal toggle persistence
expected: "Flag as a good deal" checkbox on WatchDetail toggles and persists across navigation; toggling on causes Deal badge to appear on card and watch to appear in Good Deals section
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
