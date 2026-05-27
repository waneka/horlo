---
phase: 62-public-wear-pics-on-watch-detail
verified: 2026-05-27T07:45:00Z
status: human_needed
score: 6/6 must-haves structurally verified
overrides_applied: 0
re_verification: null
human_verification:
  - test: "WPIC-01 carousel union — swipe through carousel on a /w/[ref] for a watch with public wear pics"
    expected: "Owner uploads appear first (by sortOrder), then wear pics newest-worn first. Position indicator counts all merged slides."
    why_human: "Embla swipe is touch-only; empty local test DB skips e2e; order only verifiable on prod with real data (MEMORY feedback_mobile_ui_verify_on_prod)"
  - test: "WPIC-01/D-07 — Worn badge hydration on prod (hard refresh AND soft-nav)"
    expected: "Badge shows correct UTC date with no hydration flash / React #418 mismatch in the browser console. Must check AFTER cache fills (cold read can false-positive)."
    why_human: "React #418 hydration mismatch is prod-cache-fill-dependent; cannot be reproduced locally (MEMORY project_ppr_dynamic_before_use_cache)"
  - test: "WPIC-06 — Like toggle + comment sheet on a wear-pic slide"
    expected: "Tap Like on a wear-pic slide — count updates optimistically. Tap comment count — bottom sheet opens with that pic's thread. Post a comment, dismiss by swipe or scrim tap — returns to carousel; count stays in sync."
    why_human: "Bottom-sheet open/dismiss is touch behavior; comment count sync via onCountChange is prod-interaction behavior"
  - test: "WPIC-02/D-09/D-10 — Owner eye/hide toggle in Edit mode"
    expected: "As owner, enter 'Edit photos'. Tap eye on a wear-pic thumb — thumb greys and shows 'Hidden'. Reload — pic still hidden in carousel. Toggle back — pic reappears. The pic still appears in the Wears tab and (within 48h) the Home rail (hide-from-detail is not a visibility change)."
    why_human: "Owner-gated onPointerDown interaction verifies only on prod with real wear events; empty test DB skips e2e"
  - test: "WPIC-05 — Non-public wear pic visibility gate (2nd account)"
    expected: "Viewing the same watch detail as a non-owner shows only public, non-hidden wear pics. A followers-only or private wear pic does not surface. A hidden wear pic does not surface."
    why_human: "Requires a second test account; cross-account visibility cannot be verified without real prod data"
  - test: "WPIC-04 — Home wear rail unaffected"
    expected: "Home wear rail still shows only wears within the 24/48h window after phase 62 deploy. A hidden wear pic still appears in the rail (hidden_from_detail does not affect rail visibility)."
    why_human: "Rail behavior requires real prod data and a real time window; cannot be verified on empty local DB"
---

# Phase 62: Public Wear Pics on Watch Detail — Verification Report

**Phase Goal:** Public wear photos automatically appear on the watch's detail page, the owner can hide individual surfaced pics, and all surfaced pics carry the full v6.0 social interaction layer.
**Verified:** 2026-05-27T07:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getPublicWearPicsForWatch` returns only public, not-hidden wear pics newest-worn first (WPIC-01/05) | VERIFIED | `src/data/wearEvents.ts` lines 571-591: `eq(wearEvents.visibility, 'public')` AND `eq(wearEvents.hiddenFromDetail, false)`, `orderBy(desc(wearEvents.wornDate))`; 5/5 unit tests pass |
| 2 | The owner can hide/unhide a wear pic via `.strict()`-validated, ownership-re-checking server actions (WPIC-02) | VERIFIED | `src/app/actions/wearEvents.ts` lines 296-364: `.strict()` Zod schema, `getCurrentUser` guard, `watchDAL.getWatchById(user.id, ...)` ownership re-check, DAL writes ownership-subquery-scoped; 5/5 unit tests pass |
| 3 | Hiding never mutates `visibility`; `hidden_from_detail` is a separate column (D-11 / WPIC-04 guardrail) | VERIFIED | `hideWearPic`/`unhideWearPic` only call `.set({ hiddenFromDetail: true/false })`; no `.set()` references `visibility`; `getWearRailForViewer` confirmed unchanged (lines 324-421 do not reference `hiddenFromDetail`); 6/6 wearRail guardrail tests pass |
| 4 | WornTimeline/WornCalendar prefer `event.photoUrl` over the watch cover; Wears tab signs via admin client (WPIC-03) | VERIFIED | `WornTimeline.tsx` lines 67-68: `wearPhotoSafe ?? watchCoverSafe` pattern; `WornCalendar.tsx` lines 204-210, 270-271: same preference in both calendar cell and detail panel; `u/[username]/[tab]/page.tsx` lines 446-475: admin client signing loop for `wear-photos` bucket; 4/4 unit tests pass |
| 5 | Both branches of `w/[ref]/page.tsx` fetch + sign public wear pics and pre-fetch per-pic like/comment state (WPIC-01/06) | VERIFIED | Branch 1 (lines 178-236): `getPublicWearPicsForWatch`, admin-client `wear-photos` signing, `Promise.all` per-pic social pre-fetch, `SignedWearPic` assembly; Branch 2/D-06 (lines 492-545): identical pattern; `getPublicWearPicsForWatch` referenced ≥2 times, `wear-photos` bucket signing in both branches |
| 6 | WatchPhotoSection merges slides, renders UTC-pinned badge, inline social row, WearCommentHost bottom-sheet, and owner eye/hide toggle with `onPointerDown` (WPIC-01/02/06) | VERIFIED | `WatchPhotoSection.tsx`: `SignedWearPic` interface (line 76); merged slide array (`visibleWearPics`); badge with mandatory `T00:00:00Z` + `timeZone: 'UTC'` (lines 480-484); conditional social row `{isWearPicSlide && activeWearPic && ...}` (line 543); `WearCommentHost variant="bottom-sheet"` (lines 580-599); eye/hide `onPointerDown` calling `hideWearPicAction`/`unhideWearPicAction` with `useOptimistic` revert (lines 700-729); no `'use cache'` added |

**Score:** 6/6 truths structurally verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | `hiddenFromDetail` boolean column on `wearEvents` | VERIFIED | Line 308: `hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false)` |
| `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` | Prod migration: ADD COLUMN + partial index | VERIFIED | `ALTER TABLE wear_events ADD COLUMN IF NOT EXISTS hidden_from_detail boolean NOT NULL DEFAULT false;` + `CREATE INDEX IF NOT EXISTS wear_events_watch_id_public_visible_idx` in `BEGIN;/COMMIT;` |
| `src/data/wearEvents.ts` | `getPublicWearPicsForWatch`, `hideWearPic`, `unhideWearPic` exports | VERIFIED | All three exported at lines 571, 609, 626 |
| `src/app/actions/wearEvents.ts` | `hideWearPicAction`, `unhideWearPicAction` with `.strict()` | VERIFIED | Both exported at lines 303, 335; `.strict()` schema at line 301; `revalidatePath('/w/[ref]', 'page')` in both |
| `src/components/profile/WornTimeline.tsx` | `photoUrl`-preferred image source | VERIFIED | `photoUrl` in `WearEventLite` interface (line 17); `wearPhotoSafe ?? watchCoverSafe` pattern (lines 67-68) |
| `src/components/profile/WornCalendar.tsx` | `photoUrl`-preferred image source | VERIFIED | `photoUrl` in interface (line 21); preference applied in both calendar cell (lines 204-209) and detail panel (lines 270-271) |
| `src/app/u/[username]/[tab]/page.tsx` | Admin-client wear-photo signing + `photoUrl` threaded to `WornTabContent` | VERIFIED | `createSupabaseAdminClient` (line 10/446); `wear-photos` signing loop (lines 454-463); `photoUrl` passed in `events.map` (line 474) |
| `src/app/w/[ref]/page.tsx` | Wear-pic fetch + signing + social pre-fetch in both branches | VERIFIED | `getPublicWearPicsForWatch` imported (line 10); called in both Branch 1 (line 178) and D-06 branch (line 492); `wear-photos` signed in both |
| `src/components/watch/WatchDetail.tsx` | `wearPics` + owner/viewer props threaded to `WatchPhotoSection` | VERIFIED | `wearPics?: SignedWearPic[]` in `WatchDetailProps` (line 81); threaded at line 177 |
| `src/components/watch/WatchPhotoSection.tsx` | Full wear-pic UI: `SignedWearPic`, badge, social row, comment sheet, eye/hide | VERIFIED | `export interface SignedWearPic` (line 76); UTC badge (lines 480-485); conditional social row (line 543); `WearCommentHost variant="bottom-sheet"` (line 581); `onPointerDown` hide toggle (line 707); `hideWearPicAction`/`unhideWearPicAction` imported (line 60) |
| `tests/unit/getPublicWearPicsForWatch.test.ts` | WPIC-01/05 DAL tests | VERIFIED | 5/5 PASS |
| `tests/unit/hideWearPic.test.ts` | WPIC-02 hide/unhide action tests | VERIFIED | 5/5 PASS |
| `tests/unit/WornTimeline.test.tsx` | WPIC-03 photoUrl preference tests | VERIFIED | 4/4 PASS |
| `tests/unit/wearRail.test.ts` | WPIC-04 getWearRailForViewer guardrail | VERIFIED | 6/6 PASS |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/w/[ref]/page.tsx` | `getPublicWearPicsForWatch` | DAL import + call in both branches | WIRED | `getPublicWearPicsForWatch` imported at line 10; called at lines 178 and 492 |
| `src/app/w/[ref]/page.tsx` | `wear-photos` bucket | `createSupabaseAdminClient().storage.from('wear-photos').createSignedUrl` | WIRED | Admin-client signing in both branches; no cookie client used |
| `src/app/actions/wearEvents.ts` | `watches.user_id` ownership | `watchDAL.getWatchById(user.id, watchId)` | WIRED | Lines 320, 351: ownership re-check before DAL call |
| `src/data/wearEvents.ts getPublicWearPicsForWatch` | `wear_events` | `WHERE visibility='public' AND hiddenFromDetail=false` | WIRED | Lines 585-587: `eq(wearEvents.visibility, 'public')`, `eq(wearEvents.hiddenFromDetail, false)` |
| `WatchPhotoSection.tsx eye/hide` | `hideWearPicAction`/`unhideWearPicAction` | `onPointerDown` toggle | WIRED | Lines 707-713: `onPointerDown`, `startTransition`, `action(...)` |
| `WatchPhotoSection.tsx` | `WearCommentHost variant='bottom-sheet'` | comment-count tap opens sheet | WIRED | Lines 563 (onClick sets `commentSheetOpen`), 580-599: `WearCommentHost variant="bottom-sheet"` with `open`/`onOpenChange` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `WatchPhotoSection.tsx` wear-pic slides | `wearPics` prop | `getPublicWearPicsForWatch` → admin-client signing → `SignedWearPic[]` assembled in page RSC | Yes — Drizzle query against `wear_events` with real WHERE filter; admin-client signs storage paths | FLOWING |
| `WatchPhotoSection.tsx` like state | `activeWearPic.initialLikeState` | `getLikesForTargetCached(viewerId, wearTarget)` pre-fetched in page RSC | Yes — real DB query per wear pic | FLOWING |
| `WatchPhotoSection.tsx` comment count | `wearPicCommentCounts` / `activeWearPic.commentCount` | `getCommentsForTarget(viewerId, wearTarget)` pre-fetched in page RSC | Yes — real DB query per wear pic; `onCountChange` updates local state | FLOWING |
| `WornTimeline.tsx` / `WornCalendar.tsx` image source | `e.photoUrl` | `getWearEventsForViewer` (already selects `photoUrl`) → admin-client signing in Wears-tab RSC → threaded via `WornTabContent` | Yes — real signed wear-photo URL; fallback to `watch.imageUrl` is real cover URL | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `getPublicWearPicsForWatch` filters visibility + hiddenFromDetail | `npx vitest run tests/unit/getPublicWearPicsForWatch.test.ts -x` | 5/5 PASS | PASS |
| `hideWearPicAction`/`unhideWearPicAction` ownership enforcement | `npx vitest run tests/unit/hideWearPic.test.ts -x` | 5/5 PASS | PASS |
| `WornTimeline` prefers `photoUrl` over watch cover | `npx vitest run tests/unit/WornTimeline.test.tsx -x` | 4/4 PASS | PASS |
| `getWearRailForViewer` unchanged (D-17 guardrail) | `npx vitest run tests/unit/wearRail.test.ts -x` | 6/6 PASS | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared for this phase. Build gate is `npm run build` (confirmed PASS per verification baseline).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| WPIC-01 | 62-02, 62-04 | Public wear pic automatically surfaces on watch detail | SATISFIED | `getPublicWearPicsForWatch` returns public+not-hidden rows; both page branches fetch, sign, and thread into carousel |
| WPIC-02 | 62-01, 62-02, 62-04 | Owner can hide a surfaced wear pic per-pic | SATISFIED | `hideWearPic`/`unhideWearPic` DAL + `.strict()` server actions + eye/hide filmstrip toggle in Edit mode |
| WPIC-03 | 62-03 | Wears tab shows actual wear photo over catalog image | SATISFIED | WornTimeline + WornCalendar prefer `e.photoUrl`; Wears-tab RSC signs via admin client; 4/4 tests green |
| WPIC-04 | 62-01, 62-02 | Home wear rail stays ephemeral (unchanged) | SATISFIED (structural) | `getWearRailForViewer` unchanged — 6/6 guardrail tests confirm no reference to `hidden_from_detail`; prod rail behavior is human_needed |
| WPIC-05 | 62-02 | Non-public wear pic never surfaces on watch detail | SATISFIED (structural) | DAL filters `visibility='public' AND hiddenFromDetail=false`; 5/5 tests confirm followers/private/hidden excluded; cross-account prod check is human_needed |
| WPIC-06 | 62-04 | Surfaced wear pics carry v6.0 likes/comments layer | SATISFIED (structural) | `WearCommentHost variant="bottom-sheet"` wired with `initialComments`; `LikeButton` with wear target; social row conditional-render; touch/sheet behavior is human_needed |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX markers in any modified file | — | None |
| — | — | No unresolved stubs — all `.set()` calls in DAL write only `hiddenFromDetail`, never `visibility` | — | None |
| — | — | `'use cache'` count in `WatchPhotoSection.tsx` = 0 (comment-only reference) | — | None |
| — | — | No sonner import in `src/app/actions/wearEvents.ts` (H-2 pitfall avoided) | — | None |

---

### Human Verification Required

#### 1. Carousel union + slide order (WPIC-01)

**Test:** Open `/w/[ref]` for a watch with at least 2 public wear pics. Swipe through the full carousel.
**Expected:** Owner uploads appear first (by `sortOrder`), then wear pics newest-worn first. The position indicator (e.g. "3 / 5") counts the merged total.
**Why human:** Embla swipe is touch-only; empty local test DB skips e2e (MEMORY `feedback_mobile_ui_verify_on_prod`).

#### 2. "Worn · [date]" badge hydration (WPIC-01 / D-07)

**Test:** On prod, hard-refresh the `/w/[ref]` page, then soft-navigate away and back. Inspect the badge date on each wear-pic slide. Check the browser console for hydration warnings.
**Expected:** Badge shows the correct UTC date (e.g. "Worn · May 20") with no hydration flash or React #418 mismatch. Must check AFTER the Vercel cache fills (cold read can false-positive).
**Why human:** React #418 hydration is prod-cache-fill-dependent (MEMORY `project_ppr_dynamic_before_use_cache` + `project_react_418_date_tz_hydration`).

#### 3. Like toggle + comment bottom sheet (WPIC-06)

**Test:** On a wear-pic slide, tap Like. Then tap the comment count button. Post a comment. Dismiss the sheet by swipe or scrim tap.
**Expected:** Like count updates optimistically. Bottom sheet opens with that pic's comment thread. After posting, comment count increments. After dismiss, the carousel returns and the count stays in sync.
**Why human:** Bottom-sheet open/swipe-dismiss is touch behavior; `onCountChange` sync is a prod-interaction behavior.

#### 4. Owner eye/hide toggle in Edit mode (WPIC-02 / D-09 / D-10)

**Test:** As owner, enter "Edit photos" on a `/w/[ref]` page that has surfaced wear pics. Tap the eye icon on a wear-pic filmstrip thumb. Reload the page. Then tap the restore (Eye) icon.
**Expected:** Thumb greys and shows "Hidden" label immediately (optimistic). After reload, the pic is absent from the carousel but still visible in the Wears tab and (if worn within 48h) the Home rail. Toggling back restores the pic in the carousel.
**Why human:** Owner-gated `onPointerDown` interaction + hide persistence + Wears-tab/rail presence require real prod data.

#### 5. Non-public wear pic visibility gate — 2nd account (WPIC-05)

**Test:** With a second (non-owner) account, view the same watch detail page that has a mix of public and non-public (followers-only / private) wear pics.
**Expected:** Only public, non-hidden wear pics appear in the carousel. Followers-only and private wear pics are not surfaced.
**Why human:** Requires two accounts; cross-account visibility cannot be verified without real prod data.

#### 6. Home wear rail unaffected (WPIC-04)

**Test:** Check the Home page wear rail before and after phase 62 deploy. Additionally, hide a wear pic via the eye/hide toggle, then check the Home rail.
**Expected:** The rail still shows only wears within the 24/48h window. A hidden wear pic still appears in the rail (hidden_from_detail does not affect rail visibility, only detail-page surfacing).
**Why human:** Rail requires real time-windowed data and real wear events; cannot be reproduced locally.

---

### Gaps Summary

No structural gaps found. All 6 WPIC requirements have complete implementation in the codebase, verified at all four levels (exists, substantive, wired, data-flowing). The build gate passes and all 20 phase unit tests are green.

The 6 human verification items above are the only outstanding items — they cover touch/mobile interactions, React #418 hydration on prod, and cross-account visibility checks that cannot be verified without a deployed Vercel instance and real data. These items map directly to the 6 prod checks documented in 62-04-PLAN.md Task 3 ("Prod UAT") and are expected at this stage.

---

_Verified: 2026-05-27T07:45:00Z_
_Verifier: Claude (gsd-verifier)_
