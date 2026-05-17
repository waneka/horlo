---
status: diagnosed
phase: 43-polish-pass
source: [43-VERIFICATION.md]
started: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:00:00Z
---

## Current Test

[testing complete — 2 passed, 2 issues]

## Tests

### 1. Swipe-to-dismiss on /search filter sheet
expected: On a touch device, opening the filter sheet and swiping downward dismisses it without a JS error. Sheet also dismisses on backdrop tap.
result: pass

### 2. Filter sheet dismiss not blocked while query is loading
expected: While a filtered search query is still in flight (results are loading), the filter sheet can still be swiped down or tapped-outside to close — the sheet does not stay stuck open.
result: pass

### 3. Equal-height cards in collection and wishlist grids
expected: At 375px viewport, four cards in a row with mixed metadata (brand-only / brand+wear+price / no photo / with notes) all reach the same total height within 2px.
result: pass

### 4. Avatar upload end-to-end cycle
expected: In ProfileEditForm, picking an image opens the circular crop; drag/zoom positions the crop; confirming uploads the cropped square image to the Supabase `avatars` bucket and the new avatar displays on profile surfaces. The avatar-URL text field is gone.
result: issue — upload fails. Supabase Storage returns 403 "new row violates row-level security policy". Root cause diagnosed (see Gaps GAP-43-03).

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

### GAP-43-01: Watch cards run too tall
status: failed
source: user UAT feedback (item 2 — equal-height cards pass, but overall card is too tall)
detail: Equal-height behavior works correctly, but cards are taller than desired. Tighten
  vertical spacing in `ProfileWatchCard`: reduce the top/bottom padding of the card and the
  padding above and below the watch image. Keep the equal-height CSS chain intact
  (`h-full flex flex-col` on Card, `flex-1` on CardContent, `aspect-[3/4]` on the image div).
files: [src/components/profile/ProfileWatchCard.tsx]
requirement: PLSH-04

### GAP-43-02: Add-watch buttons should not use the primary variant
status: failed
source: user UAT feedback (new — button placement approved, variant changed)
detail: The "Add to Collection" / "Add to Wishlist" buttons above the populated grids use
  `variant="default"` (primary). Change both to `variant="outline"` (user-selected). Placement
  and copy stay as-is.
files: [src/components/profile/CollectionTabContent.tsx, src/components/profile/WishlistTabContent.tsx]
requirement: PLSH-05

### GAP-43-03: Avatar upload rejected by Storage RLS (missing SELECT policy)
status: failed
source: user UAT feedback (item 4)
detail: Avatar upload fails — Supabase Storage `POST .../object/avatars/{uid}/avatar.jpg`
  returns 403 "new row violates row-level security policy". Diagnosis (confirmed via
  pg_policies query + decoded request JWT): the request carries a valid `authenticated`
  JWT whose `sub` matches the upload folder, and all 3 `avatars_*` RLS policies exist and
  are correct. The bucket is missing a `SELECT` policy. `uploadAvatarPhoto` uses
  `upsert: true`, and Supabase Storage upsert uploads require a `SELECT` policy (the
  storage-api does an object lookup on `storage.objects` to decide insert-vs-update) — not
  just INSERT. The working `catalog-source-photos` bucket has a SELECT policy AND uses
  `upsert: false`; the `avatars` migration omitted SELECT on the (wrong) assumption that a
  public bucket needs no SELECT policy — true only for CDN reads, not the authenticated
  write path.
fix: New Supabase migration adding an `authenticated`, folder-scoped `SELECT` policy on the
  `avatars` bucket (`avatars_select_own_folder` — mirror the `avatars_insert_own_folder`
  predicate). Keep `upsert: true`. Requires `supabase db push` to prod ([BLOCKING] task).
files: [supabase/migrations/]
requirement: PLSH-06
