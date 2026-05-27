---
status: partial
phase: 62-public-wear-pics-on-watch-detail
source: [62-VERIFICATION.md]
started: 2026-05-27T14:48:16Z
updated: 2026-05-27T14:48:16Z
---

## Current Test

[awaiting human testing on prod]

> Prerequisites: `git push origin main` → wait for Vercel deploy, then `supabase db push --linked` to apply the deferred prod migration (`supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql`). Re-check after the Vercel cache fills (cold reads can false-positive — do a second hard refresh or wait a few minutes per MEMORY `project_ppr_dynamic_before_use_cache`).

## Tests

### 1. Carousel union + slide order (WPIC-01)
expected: On a `/w/[ref]` for a watch with public wear pics, the carousel shows owner uploads first, then public wear pics newest-worn first; the position indicator counts the merged total (e.g. "3 / 5" for 3 owner + 2 wear). Swipe works on mobile.
result: [pending]

### 2. "Worn · [date]" badge — no React #418 hydration flash (WPIC-01 / D-07)
expected: Wear-pic slides carry a "Worn · [date]" badge showing the correct UTC date; no hydration flash/mismatch on hard-refresh AND soft-nav. Owner studio/hero uploads carry no badge.
result: [pending]

### 3. Like toggle + comment bottom sheet (WPIC-06)
expected: On a wear-pic slide, tapping Like toggles optimistically; tapping the comment count opens that pic's thread in a bottom sheet; posting a comment + dismissing (swipe/scrim) returns to the carousel with the count in sync.
result: [pending]

### 4. Owner eye/hide toggle in Edit mode (WPIC-02 / D-08/D-09/D-10)
expected: As owner, "Edit photos" → tap the eye on a wear-pic thumbnail → it greys / shows "Hidden"; reload → the pic is absent from the carousel but still present in the Wears tab and (within 48h) the Home rail; tapping the eye again restores it ("Shown on this page" toast).
result: [pending]

### 5. Non-public visibility gate (WPIC-05)
expected: Viewing the same watch detail as a NON-owner (2nd account), only public, non-hidden wear pics surface — followers-only / private wear pics never appear.
result: [pending]

### 6. Home wear rail unaffected (WPIC-04)
expected: The Home wear rail still shows only wears within the 24/48h window; surfacing on watch detail did not change rail behavior, and a pic hidden-from-detail still appears in the rail.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
