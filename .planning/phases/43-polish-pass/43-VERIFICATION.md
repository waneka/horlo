---
phase: 43-polish-pass
verified: 2026-05-17T00:00:00Z
status: passed
score: 14/14
overrides_applied: 0
human_verification_outcome: "All 4 human-verification items + all 5 UAT gap fixes verified by the user on production (www.horlo.app) and approved 2026-05-17."
human_verification:
  - test: "Swipe-to-dismiss on /search filter sheet"
    expected: "On a touch device, opening the filter sheet and swiping downward dismisses it without a JS error. Sheet also dismisses on backdrop tap."
    why_human: "Native gesture behavior and touch events cannot be verified by static code analysis or grep."
  - test: "Filter sheet dismiss not blocked while query is loading"
    expected: "While a filtered search query is still in flight (results are loading), the filter sheet can still be swiped down or tapped-outside to close — the sheet does not stay stuck open."
    why_human: "Requires an actual loading/pending race condition in the browser to test."
  - test: "Equal-height cards in collection and wishlist grids"
    expected: "At 375px viewport, four cards in a row with mixed metadata (brand-only / brand+wear+price / no photo / with notes) all reach the same total height within 2px."
    why_human: "CSS layout equality requires a rendered browser environment; grep confirms the correct CSS chain (h-full flex flex-col on Card, flex-1 on CardContent, aspect-[3/4] on image div) but cannot verify the visual outcome."
  - test: "Avatar upload — pick, crop, upload, display cycle"
    expected: "In ProfileEditForm, picking a photo shows the circular crop UI. Confirming crop updates the avatar on profile surfaces. The avatar URL text field is gone. No JS errors during the flow."
    why_human: "Requires real Supabase Storage, a live browser session, and canvas rendering — cannot be verified programmatically without a running server."
---

# Phase 43: Polish Pass — Verification Report

**Phase Goal:** Users experience a polished, consistent UI before new surfaces are added — existing UX bugs resolved and avatar upload live
**Verified:** 2026-05-17
**Status:** human_needed (14/14 automated truths verified; 4 items require human testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Watch extraction uses the non-deprecated claude-sonnet-4-6 model ID | VERIFIED | `llm.ts` line 80: `model: 'claude-sonnet-4-6'`; `claude-sonnet-4-20250514` absent from file |
| 2 | User can dismiss the /search filter sheet by swiping down | VERIFIED (code) | `FilterDrawer.tsx` line 40: `Drawer.Root … swipeDirection="down"` — runtime behavior needs human test |
| 3 | User can dismiss the /search filter sheet by tapping the backdrop | VERIFIED (code) | `Drawer.Backdrop` rendered; `onOpenChange={onOpenChange}` passed directly to `Drawer.Root` (line 40) |
| 4 | Filter sheet dismiss is never blocked while a filtered query is loading | VERIFIED (code) | `SearchPageClient.tsx` line 185: `onOpenChange={setSheetOpen}` — `setSheetOpen` is the raw useState setter, no async guard; FilterDrawer.tsx comment and code confirm D-03 |
| 5 | src/components/ui/sheet.tsx is untouched (D-02) | VERIFIED | Phase 43 commits do not include `sheet.tsx`; git log confirms only one historical commit touched it (pre-phase) |
| 6 | Wishlist and grail watch cards show no wear badge and no last-worn line | VERIFIED | `ProfileWatchCard.tsx` lines 83 and 104: both wear badge JSX and last-worn `<p>` are wrapped in `!isWishlistLike` |
| 7 | Owned watch cards still show the wear badge and last-worn line | VERIFIED | Same `!isWishlistLike` gate: when `status` is not `wishlist` or `grail`, both elements render |
| 8 | Brand and model appear above the watch image | VERIFIED | `ProfileWatchCard.tsx` lines 63-66 (brand/model `<div>`) precede line 68 (image container `<div>`) in source order |
| 9 | Every card in a grid row has identical outer height regardless of metadata or photo | VERIFIED (CSS chain) | Card has `h-full flex flex-col` (line 61); `aspect-[3/4]` only on image div (line 68); `CardContent` has `flex-1` (line 97); no `aspect-` on Card; visual equality requires human test |
| 10 | The profile owner sees an "Add to Collection" button above the populated collection grid | VERIFIED | `CollectionTabContent.tsx` lines 169-178: `{isOwner && <Button … render={<Link href=…/watch/new…>}>Add to Collection</Button>}` inside filter row, before grid |
| 11 | The profile owner sees an "Add to Wishlist" button above the populated wishlist grid | VERIFIED | `WishlistTabContent.tsx` lines 111-122: `{isOwner && <div className="mb-4 flex justify-end"><Button …>Add to Wishlist</Button></div>}` before `<OwnerWishlistGrid>` |
| 12 | Non-owner viewers see no add-watch button on either populated grid | VERIFIED | Both buttons gated behind `isOwner` boolean; non-owner populated branches render no button |
| 13 | The end-of-grid AddWatchCard tile is gone from both populated grids | VERIFIED | `CollectionTabContent.tsx` line 188: comment confirms removal (no JSX); `WishlistTabContent.tsx` line 268: comment confirms removal; `AddWatchCard` import in CollectionTabContent retained for empty-state only (D-08 compliant) |
| 14 | User can pick a profile photo, crop it, and have it stored and displayed (avatar upload live) | VERIFIED (code) | `AvatarUploader.tsx`: file pick → 8MB guard → `getCroppedBlob` → `stripAndResize(raw, 512)` → `uploadAvatarPhoto` → `updateProfile({avatarUrl})`; `ProfileEditForm.tsx` renders `<AvatarUploader>` with no URL text field; `ProfileHeader.tsx` passes `userId={props.targetUserId}`; migration and bucket confirmed in migration SQL |

**Score:** 14/14 truths verified (all automated checks pass; 4 require human testing for runtime/visual behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/search/FilterDrawer.tsx` | Base UI Drawer with swipeDirection="down" | VERIFIED | Exists, `'use client'`, `swipeDirection="down"`, `onOpenChange` unguarded, `h-2 w-10` drag handle |
| `src/lib/extractors/llm.ts` | claude-sonnet-4-6 model ID | VERIFIED | Line 80: `model: 'claude-sonnet-4-6'`; deprecated ID absent |
| `src/components/profile/ProfileWatchCard.tsx` | Restructured equal-height card | VERIFIED | `h-full flex flex-col` on Card, `aspect-[3/4]` on image div, `flex-1` on CardContent, `!isWishlistLike` gate on both wear elements |
| `src/components/profile/CollectionTabContent.tsx` | Right-aligned "Add to Collection" button | VERIFIED | Button in filter row, gated by `isOwner`, links to `/watch/new`, `min-h-[44px]` class |
| `src/components/profile/WishlistTabContent.tsx` | Right-aligned "Add to Wishlist" button | VERIFIED | Header row `mb-4 flex justify-end`, button links to `status=wishlist` URL |
| `supabase/migrations/20260516000000_phase43_avatar_bucket.sql` | avatars bucket + 3 RLS policies | VERIFIED | `BEGIN/COMMIT`, `public=true`, `file_size_limit=4194304`, exactly 3 `CREATE POLICY`, each with `DROP POLICY IF EXISTS`, no SELECT policy |
| `src/lib/storage/avatarPhotos.ts` | buildAvatarPath + uploadAvatarPhoto | VERIFIED | Exports both functions; `{userId}/avatar.jpg` path; `upsert: true`, `contentType: 'image/jpeg'`; public URL returned |
| `src/components/profile/AvatarUploader.tsx` | Circular crop + upload + EXIF strip | VERIFIED | `cropShape="round"`, `aspect={1}`, `onCropComplete` uses second arg (pixel area), 8 MB guard, exact error strings, `stripAndResize(raw, 512)` then `uploadAvatarPhoto` then `updateProfile` |
| `src/components/profile/ProfileEditForm.tsx` | Avatar URL field removed, AvatarUploader rendered | VERIFIED | No "Avatar URL" label or `type="url"` Input; `<AvatarUploader>` rendered; `handleSave` passes only `displayName` and `bio` to `updateProfile` |
| `src/components/profile/ProfileHeader.tsx` | userId prop threaded to ProfileEditForm | VERIFIED | Line 44: `userId={props.targetUserId}` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SearchPageClient.tsx` | `FilterDrawer.tsx` | import + render | VERIFIED | Import line 11; render at lines 183-193 with `open`, `onOpenChange={setSheetOpen}`, filter props |
| `FilterDrawer.tsx` | `Drawer.Root onOpenChange` | direct pass, no async guard | VERIFIED | `onOpenChange={onOpenChange}` at line 40; no `if`/`!loading`/`pending` wrapper anywhere in file |
| `CollectionTabContent` filter row | `/watch/new` | Button render={Link} | VERIFIED | Lines 169-178: `render={<Link href={returnTo ? …/watch/new?returnTo=… : '/watch/new'} />}` |
| `WishlistTabContent` header row | `/watch/new?status=wishlist` | Button render={Link} | VERIFIED | Lines 111-122: `render={<Link href={wishlistHref} />}` where `wishlistHref` contains `status=wishlist` |
| `AvatarUploader.tsx` | `avatarPhotos.ts uploadAvatarPhoto` | import + call in handleConfirmCrop | VERIFIED | Import line 21; call at line 168 after `stripAndResize` |
| `AvatarUploader.tsx` | `updateProfile` Server Action | call after successful upload | VERIFIED | Line 173: `await updateProfile({ avatarUrl: result.publicUrl })` inside `!('error' in result)` branch |
| `ProfileEditForm.tsx` | `AvatarUploader.tsx` | import + render | VERIFIED | Import line 10; rendered at lines 54-58 with `userId` and `initialUrl` props |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProfileWatchCard.tsx` | `watch` props | passed from parent (CollectionTabContent / WishlistTabContent grids) | Yes — watch data from Supabase DB (upstream fetch, not component-level) | FLOWING |
| `AvatarUploader.tsx` | `result.publicUrl` | `supabase.storage.getPublicUrl()` after real upload | Yes — produced from live Supabase Storage after canvas crop + upload | FLOWING |
| `FilterDrawer.tsx` | `open`, filter props | `useState` in `SearchPageClient` | Yes — local UI state updated by user interactions | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `llm.ts` uses claude-sonnet-4-6 | `grep -n "claude-sonnet-4-6" src/lib/extractors/llm.ts` | Line 80: match found | PASS |
| Deprecated model ID absent | `grep -q "claude-sonnet-4-20250514" src/lib/extractors/llm.ts` | No match | PASS |
| Migration has exactly 3 CREATE POLICY | `grep -c "CREATE POLICY" …avatar_bucket.sql` | Output: 3 | PASS |
| `sheet.tsx` not modified in phase 43 | `git show --stat {phase-43-commits} \| grep sheet.tsx` | No match | PASS |
| `swipeDirection="down"` present | `grep -n 'swipeDirection' FilterDrawer.tsx` | Line 40: found | PASS |
| Browser spot-checks (swipe, equal-height, avatar upload cycle) | — | Cannot test without running browser | SKIP — see Human Verification |

---

### Probe Execution

No probes declared in PLAN frontmatter. No conventional `scripts/*/tests/probe-*.sh` files reference phase 43. Step 7c: SKIPPED (no probes configured for this phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLSH-01 | 43-01 | Filter bottom-sheet dismiss never blocked by pending state | VERIFIED | `onOpenChange={setSheetOpen}` (raw setter) in SearchPageClient; no async guard in FilterDrawer |
| PLSH-02 | 43-01 | Filter bottom-sheet dismissable with downward swipe | VERIFIED (code) | `swipeDirection="down"` on `Drawer.Root`; runtime behavior needs human test |
| PLSH-03 | 43-02 | Wishlist cards show no wear details | VERIFIED | `!isWishlistLike` gates both wear badge and last-worn line in ProfileWatchCard |
| PLSH-04 | 43-02 | Consistent card height regardless of metadata/photo | VERIFIED (CSS) | `h-full flex flex-col` + `flex-1` chain correct; visual equality needs human test |
| PLSH-05 | 43-03 | Add-watch action is a button above the grid | VERIFIED | Both tabs show owner-gated buttons above populated grids; AddWatchCard removed from populated paths |
| PLSH-06 | 43-04 | User can upload profile photo from device | VERIFIED (code) | Full pipeline implemented: AvatarUploader → avatarPhotos.ts → Supabase Storage → updateProfile; runtime E2E needs human test |
| PLSH-07 | 43-01 | Watch extraction uses non-deprecated Claude model ID | VERIFIED | `claude-sonnet-4-6` in llm.ts; deprecated ID absent |

All 7 phase-43 requirements (PLSH-01 through PLSH-07) are accounted for and have implementation evidence.

No orphaned requirements: REQUIREMENTS.md Traceability table maps PLSH-01..07 exclusively to Phase 43. No additional Phase 43 requirements exist outside these 7.

Note on REQUIREMENTS.md status column: PLSH-01..05 and PLSH-07 show "Pending" in REQUIREMENTS.md (only PLSH-06 shows "Complete"). This is a documentation artifact in the requirements file and does not reflect the actual implementation state — all 7 have been implemented and verified above.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | All modified files are clean. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in any of the 8 phase-modified source files. |

---

### Human Verification Required

#### 1. Swipe-to-dismiss on /search filter sheet

**Test:** On a mobile device (or Chrome DevTools with touch emulation), open the `/search` page, apply a filter to open the filter sheet, then swipe downward on the sheet.
**Expected:** The filter sheet closes smoothly without a JS error. Tapping the backdrop (outside the sheet) should also close it.
**Why human:** Native swipe gesture behavior from Base UI Drawer cannot be verified by code analysis. The correct API (`swipeDirection="down"`) is wired, but gesture recognition requires a real touch event in a browser.

#### 2. Filter sheet dismiss not blocked while query is loading

**Test:** On `/search`, type a query to trigger a search, then quickly tap the filter icon to open the filter sheet before results finish loading. While the loading indicator is visible, swipe down or tap outside the sheet.
**Expected:** The sheet closes immediately — it does not stay stuck open waiting for the query to finish.
**Why human:** Requires a real async loading race condition in a live browser to observe. Code analysis confirms no async guard wraps `onOpenChange`, but the interaction requires runtime verification.

#### 3. Equal-height cards in collection and wishlist grids

**Test:** In a collector's profile with mixed card metadata (some cards with photos, some without; some with wear badges, some without; some with price lines), view the collection grid at a narrow viewport (375px).
**Expected:** All cards in the same grid row reach the same total height within 2px — no card is shorter than its row-mates due to missing metadata.
**Why human:** CSS layout equality requires a rendered browser. The correct CSS chain (`h-full flex flex-col` + `flex-1`) is verified in code, but visual grid behavior depends on browser layout engine behavior.

#### 4. Avatar upload — pick, crop, upload, display cycle

**Test:** In ProfileEditForm (Edit Profile dialog), tap "Upload photo", select a photo from device, drag/zoom under the circular mask, tap "Confirm crop". Then view the profile page.
**Expected:** The crop UI shows a circular overlay. After confirming, the avatar updates on the profile header. The "Avatar URL" text field is absent from the form. No console errors during the flow.
**Why human:** Requires real Supabase Storage (the `avatars` bucket), a live authenticated browser session, canvas rendering, and File API — cannot be simulated by static analysis.

---

### Gaps Summary

No gaps found. All 14 must-have truths are verified at the code level. The 4 items above are behavioral/visual/runtime checks that cannot be satisfied without a running browser — they are normal human verification items, not implementation gaps.

The phase's implementation is substantive and wired end-to-end. No stubs, no orphaned artifacts, no debt markers found.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
