---
status: complete
phase: 62-public-wear-pics-on-watch-detail
source: [62-VERIFICATION.md]
started: 2026-05-27T14:48:16Z
updated: 2026-05-27T16:54:10Z
---

## Current Test

[testing complete]

> Reconciled 2026-05-27: these 6 auto-generated human-verification items were superseded by the manual UAT run in `62-UAT.md` (prod, 6 pass + 1 cosmetic Test-4 gap). The Test-4 gap was closed by Plan 62-05 (on-photo overlay) and prod-approved this session. Mapping: HUMAN-UAT 1→62-UAT T2 (pass), 2→T3 (pass), 3→T4 (resolved/pass via 62-05), 4→T5 (pass), 5→T6 (pass), 6→T7 (pass). The deferred prod migration (`20260527000000_phase62_wear_hidden_from_detail.sql`) was confirmed applied by 62-UAT Test 1 (cold-start smoke).

## Tests

### 1. Carousel union + slide order (WPIC-01)
expected: On a `/w/[ref]` for a watch with public wear pics, the carousel shows owner uploads first, then public wear pics newest-worn first; the position indicator counts the merged total (e.g. "3 / 5" for 3 owner + 2 wear). Swipe works on mobile.
result: pass

### 2. "Worn · [date]" badge — no React #418 hydration flash (WPIC-01 / D-07)
expected: Wear-pic slides carry a "Worn · [date]" badge showing the correct UTC date; no hydration flash/mismatch on hard-refresh AND soft-nav. Owner studio/hero uploads carry no badge.
result: pass

### 3. Like toggle + comment bottom sheet (WPIC-06)
expected: On a wear-pic slide, tapping Like toggles optimistically; tapping the comment count opens that pic's thread in a bottom sheet; posting a comment + dismissing (swipe/scrim) returns to the carousel with the count in sync.
result: pass

### 4. Owner eye/hide toggle in Edit mode (WPIC-02 / D-08/D-09/D-10)
expected: As owner, "Edit photos" → tap the eye on a wear-pic thumbnail → it greys / shows "Hidden"; reload → the pic is absent from the carousel but still present in the Wears tab and (within 48h) the Home rail; tapping the eye again restores it ("Shown on this page" toast).
result: pass

### 5. Non-public visibility gate (WPIC-05)
expected: Viewing the same watch detail as a NON-owner (2nd account), only public, non-hidden wear pics surface — followers-only / private wear pics never appear.
result: pass

### 6. Home wear rail unaffected (WPIC-04)
expected: The Home wear rail still shows only wears within the 24/48h window; surfacing on watch detail did not change rail behavior, and a pic hidden-from-detail still appears in the rail.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
