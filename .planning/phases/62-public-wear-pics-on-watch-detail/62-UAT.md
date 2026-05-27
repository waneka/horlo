---
status: complete
phase: 62-public-wear-pics-on-watch-detail
source: [62-01-SUMMARY.md, 62-02-SUMMARY.md, 62-03-SUMMARY.md, 62-04-SUMMARY.md]
started: 2026-05-27T15:21:29Z
updated: 2026-05-27T15:27:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test (deploy + migration + watch detail loads)
expected: Prod deploy is live (0 unpushed commits) and the prod migration was applied via `supabase db push --linked` (20260527000000_phase62_wear_hidden_from_detail.sql). Opening a `/w/[ref]` page fresh (hard refresh + a soft-nav after cache fills) loads with no 500 / no React #419 / no error overlay; the carousel renders. A clean load confirms the `hidden_from_detail` column is live (otherwise the wear-pic DAL query would 500).
result: pass

### 2. Carousel union + slide order (WPIC-01)
expected: On a `/w/[ref]` for a watch with public wear pics, the carousel shows owner uploads first, then public wear pics newest-worn first; the position indicator counts the merged total (e.g. "3 / 5" for 3 owner + 2 wear). Swipe works on mobile.
result: pass

### 3. "Worn · [date]" badge — no React #418 hydration flash (WPIC-01 / D-07)
expected: Wear-pic slides carry a "Worn · [date]" badge showing the correct UTC date; no hydration flash/mismatch on hard-refresh AND soft-nav. Owner studio/hero uploads carry no badge.
result: pass

### 4. Like toggle + comment bottom sheet (WPIC-06)
expected: On a wear-pic slide, tapping Like toggles optimistically; tapping the comment count opens that pic's thread in a bottom sheet; posting a comment + dismissing (swipe/scrim) returns to the carousel with the count in sync.
result: issue
reported: "functional pass - i didn't notice the like/comment icons at first, i think they should be placed overlaid on the photo in the bottom right corner. it's not obvious they even apply to the wear pic you're seeing"
severity: cosmetic

### 5. Owner eye/hide toggle in Edit mode (WPIC-02 / D-08/D-09/D-10)
expected: As owner, "Edit photos" → tap the eye on a wear-pic thumbnail → it greys / shows "Hidden"; reload → the pic is absent from the carousel but still present in the Wears tab and (within 48h) the Home rail; tapping the eye again restores it ("Shown on this page" toast).
result: pass

### 6. Non-public visibility gate (WPIC-05)
expected: Viewing the same watch detail as a NON-owner (2nd account), only public, non-hidden wear pics surface — followers-only / private wear pics never appear.
result: pass

### 7. Home wear rail unaffected (WPIC-04)
expected: The Home wear rail still shows only wears within the 24/48h window; surfacing on watch detail did not change rail behavior, and a pic hidden-from-detail still appears in the rail.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Like + comment controls on a wear-pic slide are discoverable and visually associated with the wear pic being viewed"
  status: failed
  reason: "User reported: functional pass - i didn't notice the like/comment icons at first, i think they should be placed overlaid on the photo in the bottom right corner. it's not obvious they even apply to the wear pic you're seeing"
  severity: cosmetic
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
