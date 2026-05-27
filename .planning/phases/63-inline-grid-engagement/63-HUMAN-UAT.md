---
status: partial
phase: 63-inline-grid-engagement
source: [63-VERIFICATION.md]
started: 2026-05-27T20:28:29Z
updated: 2026-05-27T20:28:29Z
---

## Current Test

[awaiting human testing — push origin main → Vercel, then test on prod against a second account's profile]

## Tests

### 1. Like chip — optimistic flip + no navigation
expected: Tap ♥ on another user's grid card; heart fills immediately and the count bumps, with NO navigation to /w/[ref].
result: [pending]

### 2. Unlike — silent rollback
expected: Tap the filled ♥ again; heart unfills and the count decrements. Idempotent re-like never raises a user-facing error toast.
result: [pending]

### 3. Comment chip opens sheet without navigating
expected: Tap 💬 on a card where you have mutual-follow (or a non-wishlist/wear target); the bottom sheet slides up showing the watch identity (thumbnail + brand/model), with NO navigation to /w/[ref].
result: [pending]

### 4. Post comment via sheet
expected: Type a comment and submit; the sheet closes, the card's 💬 count bumps +1, and a 'Comment posted' toast fires. (On failure: typed text is retained and a failure toast appears.)
result: [pending]

### 5. Card body navigation preserved
expected: Tap the image or text region above/around the chips (not on a chip); the card navigates to /w/[ref] as before.
result: [pending]

### 6. Owner view — no chips
expected: On your OWN profile grid, no ♥/💬 chips and no scrim appear — only the existing static count line. (Owner experience unchanged; no drag-reorder conflict on the wishlist.)
result: [pending]

### 7. Gated viewer — comment gate enforced per card
expected: As a NON-mutual viewer on another user's WISHLIST grid, the ♥ chip shows but the 💬 chip is hidden entirely (no locked/teaser affordance). Non-wishlist and wear targets stay open.
result: [pending]

### 8. Navigate-back shows fresh state (D-12 cache-tag bust)
expected: Like a watch, navigate away and back (soft nav); the server-fresh liked state and counts are shown (the viewer:{userId}:counts tag busts so re-hydration is fresh). Verify after the cache has warmed (a cold first read can be a false negative).
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
