---
status: partial
phase: 48-user-facing-bug-fixes
source: [48-VERIFICATION.md]
started: 2026-05-19T00:00:00Z
updated: 2026-05-19T00:00:00Z
---

## Current Test

[Tests 1–3 (BUG-02) PASSED on local dev server with fresh .next cache; Tests 4–5 (BUG-01) deferred to post-deploy verification on prod]

## Tests

### 1. Dark-mode legibility of removable filter chips on /search (results branch)
expected: With `.dark` applied, the inline removable chips (archetype/brand/era/genre) render with legible near-white text (`text-foreground` over `bg-accent/10` tinted pill) AND the trailing X icon is clearly visible. Tested in the results branch (post-search). No black-on-dark text anywhere on a chip.
result: passed (2026-05-19, local dev, fresh .next cache after stale-server restart)

### 2. Dark-mode legibility of removable filter chips on /search (zero-results branch)
expected: Same as test 1 but tested in the zero-results branch (no matches for current filters). Both branches must render identically — leaving only one branch migrated would re-introduce BUG-02 in the other (RESEARCH.md Pitfall 2).
result: passed (2026-05-19, local dev)

### 3. Light-mode regression check
expected: Toggle back to light mode at /search. Removable chips remain readable. Drawer toggle chips (Brand/Era/Genre/Archetype/Movement/CaseSize/Style) render correctly in both selected and unselected states. No visual regression from the chip primitive migration.
result: passed (2026-05-19, local dev)

### 4. Catalog page ownership label — wishlist watch
expected: Add a watch to wishlist, then navigate to it via `/catalog/[catalogId]` (from /search, click the catalog tile). The catalog page should NOT show "You own this watch" framing. It should show the standard cross-user verdict.
result: [pending — verify on prod after deploy]

### 5. Catalog page ownership label — owned watch (regression guard for D-03)
expected: For a watch in the user's owned collection, navigate to `/catalog/[catalogId]`. The "You own this watch" callout STILL appears (the BUG-01 fix did not regress the owned path).
result: [pending — verify on prod after deploy]

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
