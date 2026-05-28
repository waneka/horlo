---
phase: 62-public-wear-pics-on-watch-detail
plan: 04
subsystem: ui
tags: [next.js, react, supabase, storage, carousel, wear-pics, social, optimistic-ui]

# Dependency graph
requires:
  - phase: 62-public-wear-pics-on-watch-detail/62-02
    provides: getPublicWearPicsForWatch DAL, hideWearPicAction/unhideWearPicAction server actions
  - phase: 62-public-wear-pics-on-watch-detail/62-01
    provides: wearRail D-17 guardrail unit tests (54/54 green)
  - phase: 61-photo-upload-carousel
    provides: Phase 61 WatchPhotoSection carousel, SignedPhoto type, admin-client signing pattern
  - phase: 57-social-layer
    provides: WearCommentHost bottom-sheet variant, LikeButton with wear targets, CommentWithAuthor type
provides:
  - Wear-pic slides merged into /w/[ref] carousel (owner uploads first, wear pics newest-worn)
  - UTC-pinned "Worn · [date]" badge on each wear-pic slide (React #418 guard)
  - Inline like + comment-count row on wear-pic slides; comment-count tap opens WearCommentHost bottom sheet
  - Owner eye/hide toggle in Edit mode with onPointerDown + optimistic update + server actions
  - SignedWearPic type exported from WatchPhotoSection.tsx
  - Admin-client signing of wear-photos bucket URLs with fail-safe-to-placeholder (T-62-12)
affects: [64-ia-redesign, 63-grid-engagement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SignedWearPic as a distinct type (not unioned with SignedPhoto) enables discriminated narrowing in WatchPhotoSection"
    - "Option A pre-fetch: all wear-pic like/comment state fetched in the page RSC via Promise.all per pic"
    - "Admin-client signing of wear-photos bucket — same pattern as Phase 61 owner photos; cookie client never used"
    - "onPointerDown for hide/unhide toggle (not onClick) — prevents Router Cache stale-instance bug (Phase 52 lesson)"
    - "UTC + en-US pin on wear-pic badge date: new Date(wornDate+'T00:00:00Z').toLocaleDateString('en-US', { timeZone:'UTC' }) guards React #418"

key-files:
  created: []
  modified:
    - src/app/w/[ref]/page.tsx
    - src/components/watch/WatchDetail.tsx
    - src/components/watch/WatchPhotoSection.tsx

key-decisions:
  - "Option A pre-fetch selected: all wear-pic like/comment state fetched per-pic in the page RSC (avoids client-side waterfall, consistent with existing CommentThread pre-fetch pattern)"
  - "SignedWearPic kept distinct from SignedPhoto — union would collapse discriminant needed for badge/social-row conditional rendering"
  - "eye/hide toggle uses onPointerDown not onClick — consistent with existing Phase 61 editMode toggle and avoids Router Cache stale-instance issue"
  - "Prod UAT deferred to HUMAN-UAT: touch/swipe/sheet + React #418 hydration can only be verified on prod (empty test DB skips e2e per project workflow)"

patterns-established:
  - "Wear-pic slides: SignedWearPic type, UTC-pinned badge formatter, inline social row, WearCommentHost bottom-sheet, eye/hide optimistic pattern"

requirements-completed: [WPIC-01, WPIC-02, WPIC-06]

# Metrics
duration: chain-auto (Tasks 1-2 in prior session; continuation agent closes out)
completed: 2026-05-27
---

# Phase 62 Plan 04: Wear Pics Stitch into /w/[ref] Carousel Summary

**Carousel now unions owner uploads + public wear pics (newest-worn), with UTC-pinned badge, inline like/comment row, WearCommentHost bottom sheet, and owner eye/hide Edit-mode toggle — code build-gated; prod UAT deferred to HUMAN-UAT**

## Performance

- **Duration:** chain-auto execution (Tasks 1-2 in prior session; plan closure in continuation agent)
- **Started:** 2026-05-27 (prior session)
- **Completed:** 2026-05-27T14:32:26Z
- **Tasks:** 2 code tasks complete + 1 prod UAT deferred
- **Files modified:** 3

## Accomplishments

- Page RSC (both branches of UnifiedWatchContent) fetches public wear pics via Plan 02 DAL, signs them via admin client with fail-safe-to-placeholder (closes Phase 61 deferred item for wear-photos bucket), and pre-fetches per-pic like/comment state (Option A) assembled into SignedWearPic shape
- WatchPhotoSection extended: merged slide order (owner photos first, wear pics newest-worn), UTC-pinned "Worn · [date]" badge (React #418 / T-62-15 guard), inline social row (LikeButton + comment-count opener) on wear-pic active slides, WearCommentHost bottom-sheet with onCountChange sync
- Owner eye/hide toggle in Edit mode: non-sortable wear-pic filmstrip wrapper, EyeOff/Eye onPointerDown toggle, useOptimistic flag mirroring existing delete pattern, hideWearPicAction/unhideWearPicAction server actions, opacity-50 on IMAGE element only, success/error toasts

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch + sign public wear pics, pre-fetch comments, assemble slides (page RSC)** - `8a4b42f` (feat)
2. **Task 2: SignedWearPic type, merged slides, Worn badge, social row, eye/hide Edit mode, comment sheet** - `b05058a` (feat)
3. **Task 3: Prod UAT** - DEFERRED to HUMAN-UAT (see below)

## Files Created/Modified

- `src/app/w/[ref]/page.tsx` — Both UnifiedWatchContent branches: getPublicWearPicsForWatch fetch, admin-client wear-photos signing (fail-safe), Promise.all per-pic social pre-fetch, SignedWearPic assembly, wearPics prop threaded to WatchDetail
- `src/components/watch/WatchDetail.tsx` — wearPics + WearCommentHost owner/viewer props added to WatchDetailProps, threaded to WatchPhotoSection
- `src/components/watch/WatchPhotoSection.tsx` — SignedWearPic interface exported, wearPics prop, merged slide array, Worn badge (UTC-pinned), inline social row, WearCommentHost bottom-sheet, eye/hide Edit-mode control

## Decisions Made

- **Option A pre-fetch** — All wear-pic like/comment state resolved in the page RSC per pic via Promise.all. Avoids client-side waterfall; consistent with CommentThread pre-fetch pattern.
- **SignedWearPic distinct from SignedPhoto** — Keeping types separate preserves the discriminant needed for badge and social-row conditional rendering; union would collapse narrowing.
- **onPointerDown for hide toggle** — Consistent with the existing Phase 61 editMode onPointerDown toggle; avoids Router Cache stale-instance issue documented in Phase 52/56A.
- **Prod UAT deferred to HUMAN-UAT** — Touch/swipe/sheet behavior and React #418 hydration can only be verified on prod after cache fills; empty test DB skips e2e (project workflow per MEMORY feedback_mobile_ui_verify_on_prod).

## Deviations from Plan

None — plan executed as specified. Tasks 1 and 2 implemented exactly the described SignedWearPic type, page RSC fetch/sign/pre-fetch, WatchPhotoSection merged slides, badge, social row, eye/hide toggle. Task 3 is a human-gated prod UAT which is deferred per autonomous chain protocol.

## Issues Encountered

None during code implementation (Tasks 1-2). Build exits 0; 54/54 unit tests pass including wearRail D-17 guardrail and getPublicWearPicsForWatch / hideWearPic unit tests.

## Pending Human Verification (Task 3 — HUMAN-UAT Required)

Task 3 is classified **human_needed**. The 6 prod checks below must be performed AFTER deploying to Vercel and after the cache fills (cold reads can false-positive — MEMORY project_ppr_dynamic_before_use_cache):

| # | Req | Check |
|---|-----|-------|
| 1 | WPIC-01 | Open /w/[ref] for a watch with public wear pics. Owner uploads first, wear pics newest-worn. Position indicator counts ALL slides. |
| 2 | WPIC-01/D-07 | "Worn · [date]" badge shows correct UTC date with NO hydration flash — hard refresh AND soft-nav. |
| 3 | WPIC-06 | On a wear-pic slide: tap Like (optimistic toggle); tap comment count → bottom sheet opens with that pic's thread; post comment, dismiss by swipe/scrim → returns to carousel; count stays in sync. |
| 4 | WPIC-02/D-09/D-10 | As owner, enter "Edit photos"; tap eye on wear-pic thumb → greys + "Hidden"; reload → still hidden in carousel but present in Wears tab; toggle back → reappears. |
| 5 | WPIC-05 | As non-owner: only public non-hidden wear pics visible; no followers-only/private pic surfaces. |
| 6 | WPIC-04 | Home wear rail only shows wears within the 24/48h window (unchanged by this plan). |

## Known Stubs

None — all data paths are wired. Wear-pic slides display real signed URLs from the wear-photos bucket (fail-safe to placeholder on signing error), real like/comment counts from the pre-fetched social state, and real hide state from hiddenFromDetail in the DAL response.

## Threat Flags

No new trust boundaries introduced beyond those in the plan's threat model. T-62-12 (admin-client signing), T-62-13 (visibility filter in DAL), T-62-14 (IDOR ownership re-check in server actions), T-62-15 (UTC hydration pin), T-62-16 (cache contract untouched) — all mitigated as specified.

## Next Phase Readiness

- Phase 62 Plan 04 code is complete and build-gated. Prod deploy + human UAT needed before phase can be formally verified.
- Phase 63 (grid engagement, depends on Phase 59 only) can proceed in parallel.
- Phase 64 (IA redesign, depends on 61+62+63) should wait for Phase 62 prod UAT to confirm no regressions.

---
*Phase: 62-public-wear-pics-on-watch-detail*
*Completed: 2026-05-27*
