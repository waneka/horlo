---
status: resolved
phase: 43-polish-pass
source: [43-VERIFICATION.md]
started: 2026-05-17T00:00:00Z
updated: 2026-05-17T00:00:00Z
---

## Current Test

[testing complete — all 4 UAT items pass; all 5 gaps resolved and approved by user 2026-05-17]

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
result: pass — avatar upload works after the GAP-43-03 SELECT-policy fix (applied to prod, user-verified 2026-05-17).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### GAP-43-01: Watch cards run too tall
status: resolved (partial — padding tightened by 43-05; remaining height addressed by GAP-43-04)
source: user UAT feedback (item 2 — equal-height cards pass, but overall card is too tall)
detail: 43-05 tightened ProfileWatchCard padding (header pt-3→pt-2, content p-3→px-3 py-2).
  Padding is now near its floor; the remaining excess height is the portrait image aspect —
  see GAP-43-04.
files: [src/components/profile/ProfileWatchCard.tsx]
requirement: PLSH-04

### GAP-43-02: Add-watch buttons should not use the primary variant
status: resolved (approved — 43-05 changed both buttons to variant="outline")
source: user UAT feedback (new — button placement approved, variant changed)
detail: The "Add to Collection" / "Add to Wishlist" buttons above the populated grids changed
  from `variant="default"` to `variant="outline"`. Approved by user.
files: [src/components/profile/CollectionTabContent.tsx, src/components/profile/WishlistTabContent.tsx]
requirement: PLSH-05

### GAP-43-04: Watch card image still too tall — change aspect ratio
status: resolved (approved — 43-07 changed ProfileWatchCard image to aspect-square; ~60px shorter; user-verified)
source: user UAT feedback (round 2 — padding trim was not enough)
detail: After 43-05 tightened padding, cards are still too tall. The dominant height driver
  is the portrait `aspect-[3/4]` image. User decision: change the image container aspect from
  `aspect-[3/4]` to `aspect-square` (1:1) in `ProfileWatchCard`. This shortens each card by
  roughly 60px. Keep the equal-height CSS chain intact (`h-full flex flex-col` on Card,
  `flex-1` on CardContent, aspect class stays on the image div only — NEVER on the Card).
  Update any test that asserts `aspect-[3/4]`.
files: [src/components/profile/ProfileWatchCard.tsx]
requirement: PLSH-04

### GAP-43-05: Settings profile section is a non-functional stub
status: resolved (approved — 43-07 replaced the stub with the real ProfileEditForm; user-verified)
source: user UAT feedback (new — /settings#profile shows "Profile editing coming in the next update.")
detail: `src/components/settings/ProfileSection.tsx` is an intentional read-only stub (Phase 22
  D-19; the comment notes "Phase 25 (UX-08) replaces this stub with a profile-edit form" — that
  never happened). It renders avatar + name + a "View public profile" link + the footer note
  "Profile editing coming in the next update." User wants the settings Profile section to
  actually edit the profile, using the SAME options that already exist — i.e. the existing
  `ProfileEditForm` (`src/components/profile/ProfileEditForm.tsx`), which provides display name,
  bio, and the device avatar upload (Phase 43 AvatarUploader).
fix: Replace the `ProfileSection` stub body with the existing `ProfileEditForm`. `ProfileEditForm`
  requires `initial` (displayName, bio, avatarUrl), `userId`, and `onDone` props — the settings
  page (`src/app/settings/page.tsx`) must fetch `bio` and the current user's `userId` and pass
  them through `SettingsTabsShell` → `ProfileSection`. Remove the "coming in the next update"
  footer note. Reuse the existing `updateProfile` Server Action (already wired in ProfileEditForm) —
  no new mutation path. Keep the "View public profile" link.
files: [src/components/settings/ProfileSection.tsx, src/app/settings/page.tsx, src/components/settings/SettingsTabsShell.tsx]
requirement: PLSH (polish — no dedicated REQ; settings profile-editing was deferred from Phase 25 UX-08)

### GAP-43-03: Avatar upload rejected by Storage RLS (missing SELECT policy)
status: resolved (approved — 43-06 added avatars_select_own_folder SELECT policy, applied to prod)
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
