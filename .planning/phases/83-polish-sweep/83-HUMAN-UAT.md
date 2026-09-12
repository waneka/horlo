---
status: complete
phase: 83-polish-sweep
source: [83-VERIFICATION.md]
started: 2026-07-14T21:28:54Z
updated: 2026-09-12T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. POLISH-02 mobile dropdown scope (iPhone Safari on prod)
expected: On the Worn tab, opening the "log a wear" watch dropdown AND the events-filter dropdown shows only currently-owned watches — no wishlist or grail items. The "All watches" default option in the events filter still appears and still lists historical wear events for any watch (including previously-owned/demoted ones).
result: pass

### 2. POLISH-03 mobile dialog copy (iPhone Safari on prod)
expected: On a wishlist or grail watch detail page (as owner), tap the "Remove from wishlist" outline button; the confirmation dialog title reads "Remove from wishlist"; body reads "Remove {brand} {model} from your wishlist?" (no "add it back" sentence — D-09 amended per review CR-01); confirm button reads "Remove from wishlist" (destructive variant). Tapping Cancel dismisses; tapping confirm removes and navigates away. On an OWNED watch detail page, the affordance still reads "Delete" with the destructive variant (per D-08 — unchanged).
result: pass
retest: true
previous_result: issue — "on my wishlist, i still see \"delete\" instead of \"remove from wishlist\"" (fixed by 83-04, 23bcca75)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Owner viewing a wishlist/grail watch detail page sees an outline 'Remove from wishlist' trigger; dialog title/body/confirm use 'Remove from wishlist' copy ('You can add it back any time.'); owned watches keep destructive 'Delete'"
  status: resolved
  reason: "User reported: on my wishlist, i still see \"delete\" instead of \"remove from wishlist\""
  severity: major
  test: 2
  root_cause: "Plan 83-03 edited the legacy src/components/watch/WatchDetail.tsx, which is no longer rendered by /w/[ref] (Phase 64 D-02/D-09 replaced it with WatchDetailHero; only WatchDetail.isChronometer.test.tsx still imports it). The live delete dialog in src/components/watch/WatchDetailHero.tsx:379-408 still has hardcoded 'Delete' / 'Delete Watch' / destructive trigger. Verification passed because it grepped the edited file, not the rendered route."
  artifacts:
    - path: "src/components/watch/WatchDetailHero.tsx"
      issue: "Delete dialog (lines 379-408) not branched on isWishlistLike (already derived at line 142)"
    - path: "src/components/watch/WatchDetail.tsx"
      issue: "Dead island that received the 83-03 edit"
  missing:
    - "Port the 83-03 isWishlistLike branching (trigger variant+label, title, description, confirm label) into WatchDetailHero.tsx"
    - "Test asserting the copy on WatchDetailHero (the rendered component)"
  debug_session: ""

