---
status: partial
phase: 83-polish-sweep
source: [83-VERIFICATION.md]
started: 2026-07-14T21:28:54Z
updated: 2026-07-14T21:28:54Z
---

## Current Test

[awaiting human testing after prod deploy]

## Tests

### 1. POLISH-02 mobile dropdown scope (iPhone Safari on prod)
expected: On the Worn tab, opening the "log a wear" watch dropdown AND the events-filter dropdown shows only currently-owned watches — no wishlist or grail items. The "All watches" default option in the events filter still appears and still lists historical wear events for any watch (including previously-owned/demoted ones).
result: [pending]

### 2. POLISH-03 mobile dialog copy (iPhone Safari on prod)
expected: On a wishlist or grail watch detail page (as owner), tap the "Remove from wishlist" outline button; the confirmation dialog title reads "Remove from wishlist"; body reads "Remove {brand} {model} from your wishlist? You can add it back any time."; confirm button reads "Remove from wishlist" (destructive variant). Tapping Cancel dismisses; tapping confirm removes and navigates away. On an OWNED watch detail page, the affordance still reads "Delete" with the destructive variant (per D-08 — unchanged).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
