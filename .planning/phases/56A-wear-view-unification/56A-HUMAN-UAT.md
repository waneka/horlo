---
status: partial
phase: 56A-wear-view-unification
source: [56A-VERIFICATION.md]
started: 2026-05-23
updated: 2026-05-23
note: "UAT batch-2 gaps (6) are CODE-CLOSED after gap closure (plans 56A-06..09 + code-review fixes CR-01/WR-01/IN-02). Re-verification scored 16/16 in code with zero base regressions. The tests below are the on-device PROD re-verification — the user will confirm on their phone after the gap-closure deploy. Batch-1 refinements bundle into this same deploy."
---

## Current Test

[awaiting on-device prod verification after the gap-closure deploy — 10 items below]

## Tests

### 1. Stories lane is full-screen with no nav chrome (SC-2)
expected: On a mobile device, opening `/wears/[username]` shows the photo full-bleed with NO bottom nav and NO slim top nav; page fits the viewport with no page scroll.
result: pending

### 2. Comment bottom-sheet pauses the swipe (SC-2, D-10/D-11)
expected: On `/wears/[username]`, tapping the comment trigger opens a bottom sheet over the photo ("No comments yet."); horizontal swiping is disabled while open; closing re-enables swipe.
result: pending

### 3. `/wear/[id]` retains nav and scrolls vertically (SC-3)
expected: Opening a `/wear/[id]` permalink directly shows the nav bars, scrolls vertically, renders the shared WearCard with the inline comment section, and has a working back/close.
result: pending

### 4. Inline comment trigger scrolls to the comment section (SC-3, D-10)
expected: On `/wear/[id]`, tapping the comment trigger smooth-scrolls to the inline `#wear-comments` section.
result: pending

### 5. Cross-user swipe FORWARD past the last wear (gap #1, D-06)
expected: Swiping past the LAST wear on `/wears/[username]` navigates to the NEXT user's lane; at the end of the rail nothing happens.
result: pending

### 6. Cross-user swipe BACKWARD before the first wear (gap #1, D-06)
expected: Swiping before the FIRST wear navigates to the PREVIOUS user's lane; at the start of the rail nothing happens.
result: pending

### 7. Watch brand/model link (gap #2, D-01)
expected: Tapping the brand/model text on a wear card navigates to `/watch/[watchId]` for that watch (works on both `/wears/[username]` and `/wear/[id]`).
result: pending

### 8. IG-stories progress indicator (gap #3)
expected: On `/wears/[username]`, the top segments track the current slide (current = bright white, others faded); a chevron hint appears on the last segment when a next-rail user exists.
result: pending

### 9. Desktop edge arrows (gap #6)
expected: On desktop (>=768px), left/right arrows navigate wears and cross user lanes at boundaries; arrows are NOT visible on mobile.
result: pending

### 10. Mobile photo renders on /wear/[id] (gap #5, BLOCKER)
expected: On a real ~375px mobile device, the `/wear/[id]` photo + avatar/username + brand/model overlays render and fill ~375px width at ~4:5 — the block is NOT collapsed/blank.
result: pending

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

> The 6 UAT batch-2 gaps are CODE-CLOSED (verified 16/16 against source). Items 5–10 above are the
> on-device re-confirmation of those fixes; items 1–4 are the original SC checks. Run `/gsd-verify-work 56A`
> after prod verification to record results and flip status → resolved.
>
> Deferred code-review findings (NOT gaps; documented in 56A-REVIEW-GAPS.md):
> - WR-02: close button (z-30) vs WearOverflowMenu (z-20) can share top-3 right-3 coords on desktop / tall mobile.
> - WR-03: brand/model Link tap could race embla click-suppression on a borderline touch drag.
> - IN-01: progress segments use array index as React key (stable list — non-bug).
