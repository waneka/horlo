---
status: partial
phase: 43-polish-pass
source: [43-VERIFICATION.md]
started: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Swipe-to-dismiss on /search filter sheet
expected: On a touch device, opening the filter sheet and swiping downward dismisses it without a JS error. Sheet also dismisses on backdrop tap.
result: [pending]

### 2. Filter sheet dismiss not blocked while query is loading
expected: While a filtered search query is still in flight (results are loading), the filter sheet can still be swiped down or tapped-outside to close — the sheet does not stay stuck open.
result: [pending]

### 3. Equal-height cards in collection and wishlist grids
expected: At 375px viewport, four cards in a row with mixed metadata (brand-only / brand+wear+price / no photo / with notes) all reach the same total height within 2px.
result: [pending]

### 4. Avatar upload end-to-end cycle
expected: In ProfileEditForm, picking an image opens the circular crop; drag/zoom positions the crop; confirming uploads the cropped square image to the Supabase `avatars` bucket and the new avatar displays on profile surfaces. The avatar-URL text field is gone.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
