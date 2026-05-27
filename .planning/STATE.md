---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Watch Photos & Detail Redesign
status: executing
stopped_at: Phase 64 UI-SPEC approved
last_updated: "2026-05-27T23:11:03.745Z"
last_activity: 2026-05-27 -- Phase 64 planning complete
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v7.0 roadmap created)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 63 — Inline Grid Engagement

## Current Position

Phase: 63 (Inline Grid Engagement) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Next phase: 63 (Inline Grid Engagement) — next incomplete in ROADMAP
Last activity: 2026-05-27 -- Phase 64 planning complete

Progress: [██████████] 100%

## Performance Metrics

- v6.0: 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days
- 34/34 v6.0 requirements shipped
- Blockers encountered: 0

## Accumulated Context

### Key Decisions

- **vi.hoisted() required for vitest mock error classes** — vi.mock factories are hoisted before top-level let/const initialization; error class stubs must live inside vi.hoisted() (Phase 61 Plan 01 lesson).
- **getWatchPhotosForWatch has no userId param** — ownership resolved by RSC before calling; pure read by watchId; signing happens at page level per PATTERNS.md.
- **Variant C is a hard cutover** (operator decision 2026-05-25) — legacy `/watch/[id]` + `/catalog/[catalogId]` routes are REMOVED (no redirect); un-migrated links fail loudly; CI guard is the completeness guarantee (ROUTE-03).
- **`watches_catalog` is NOT wipeable** — in-place ALTER only for photo schema; data migrations keyed by (brand, model, reference), not id (ids diverge local/prod).
- **`workflow.use_worktrees = false` is permanent** — this project is build-gated + DB-touching; `.env.local` unavailable in worktrees.
- **DB migrations**: `drizzle-kit push` LOCAL ONLY; prod uses `supabase db push --linked`.
- **Phase ordering is locked**: 59 (route merge) → 60 (photo schema/DAL) → 61 (photo UI) → 62 (wear pics surfacing) → 63 (grid engagement, depends on 59 only) → 64 (IA redesign, depends on 61+62+63).
- **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** — do not re-enable (Phase 52 lesson).
- **Phase 64 must preserve Phase 51/52 Cache Components structure** — CommentThread stays an uncached Suspense sibling.
- **OtherOwnersRoster + CatalogPageActions on unified route are cross-user only** — gated on `!isOwner` per spike §4.D; Phase 64 IA redesign resolves definitively.
- **Build-gate proven (ROUTE-03/D-11)** — `npm run build` exits 1 with any `/watch/${` literal; exits 0 clean. Vercel will block deploys with missed link migrations.
- **Tests for deleted legacy pages removed** — `tests/app/catalog-page.test.ts` and `tests/app/watch-page-verdict.test.ts` deleted (imported the now-deleted pages); unified route integration coverage in `tests/integration/phase59-unified-route.test.ts` from Plan 01.
- **watch_photos Supabase migration is authoritative** — backfill + lossless assert + DROP COLUMN + RLS + bucket live in `20260525000000_phase60_watch_photos.sql`; Drizzle migration `0013_phase60_watch_photos.sql` is local-sync only; prod push is Plan 04.
- **src/data/watches.ts temporarily broken on row.imageUrl** — RESOLVED in Plan 03 (mappers repointed; cover subquery across all 3 read paths).
- **Cover subquery returns raw storagePath** — Phase 61 signs URLs; DAL stays admin-client-free (D-04/D-06 Open Q1 decision).
- **embla v8 uses watchDrag (not draggable) in reInit()** — PLAN referenced `draggable` but embla v8 renames to `watchDrag`; auto-fixed in Phase 61 Plan 02 (functionally identical).
- **signedPhotos is optional in WatchDetailProps** — backward compat; RSC always passes it; old image block in `else` branch for non-Phase-61 callers.
- **WatchPhotoStep imports PhotoDropzone** — reuses Plan 02 upload pipeline instead of inlining (avoids ~100 lines of duplication; plan explicitly permitted this).
- **onWatchCreated callback intercepts WatchForm create-success** — optional prop fires with (watchId, dest) instead of router.push; all other WatchForm callers are backward compatible.
- **signCoverUrls must be called outside 'use cache' scope** — createSupabaseServerClient reads cookies() which is unavailable in cached context; resolveProfileShellSigned wrapper added outside cached scope in profile-shell-resolver.tsx (Phase 61 Plan 04).
- **D-07 Cover badge edit-mode only** — `isCover && editMode` gate in SortablePhotoThumb; no Cover span in WatchPhotoSection view-mode filmstrip (Plan 05 UAT-confirmed revision).
- **Immediate optimistic delete uses aborted-signal pattern** — `signal.aborted = true` + no-op transition flushes `useOptimistic` on Undo; `setDeletedIds` fires at click time, `deleteWatchPhotoAction` only after 5s timeout (Plan 05 gap #6).
- **PhotoDropzone id prop** — allows filmstrip +Add tile to trigger full-width dropzone below filmstrip via `document.getElementById` click (Plan 05 gap #2).
- **WatchForm onWatchCreated suppresses success toast** — when onWatchCreated is present on create-mode commit, pass {} opts to run() so no Sonner toast action-button can navigate away from the photos-pending step; WatchPhotoStep onDone/onSkip own all navigation (Plan 06 gap #9 fix).
- **P61-BUG-01 static guard** — tests/static/ppr-dynamic-before-use-cache.test.ts with @vitest-environment node encodes the durable ordering rule for the two fixed PPR routes; prevents silent recurrence of the React #419 soft-nav regression (Plan 06 gap #1 guard).
- **hideWearPic/unhideWearPic use dual-layer ownership** — server action re-checks via watchDAL.getWatchById; DAL adds a second layer via sql`` subquery WHERE watch_id IN (SELECT id FROM watches WHERE user_id = ?); defense in depth for T-62-04 IDOR threat.
- **WearEventLite.photoUrl propagates through WornTabContent** — added photoUrl to WornTabContent's local WearEventLite (the intermediary type) so TypeScript enforces the chain from page.tsx RSC through to WornTimeline and WornCalendar.
- **Option A pre-fetch for wear-pic social state** — all wear-pic like/comment state fetched per-pic in the page RSC via Promise.all; avoids client waterfall; consistent with CommentThread pattern (Phase 62 Plan 04).
- **SignedWearPic kept distinct from SignedPhoto** — union would collapse discriminant needed for badge/social-row conditional rendering in WatchPhotoSection (Phase 62 Plan 04).
- **eye/hide toggle uses onPointerDown** — consistent with Phase 61 editMode toggle; avoids Router Cache stale-instance issue (Phase 62 Plan 04).
- **Per-slide wear-pic social overlay uses wp loop var** — each slide's LikeButton target and comment count use `wp.wearEventId` (not `activeWearPic`) so every slide is independently interactive; JSX-position-only relocation closes WPIC-06 UAT Test 4 cosmetic gap (Phase 62 Plan 05).
- **Social comment button keeps onClick** — fresh-per-interaction controls are not subject to the Router-Cache stale-instance onPointerDown mitigation; that mitigation applies only to one-shot editMode / eye-hide toggles (Phase 62 Plan 05).
- **Q6 single inArray query for viewer liked set** — `inArray(watchLikes.watchId, watchIds) + eq(watchLikes.userId, viewerId)` is a single batched query; `viewerLikedSet = new Set(rows.map(r => r.watchId))`; no N+1 (Phase 63 Plan 01).
- **canComment reuses existing allowedSet** — `getBatchedWatchCounts` already computes `allowedSet` for Q5 comment-count gate; `canComment = allowedSet.has(id)` adds zero new queries (Phase 63 Plan 01).
- **D-12 gap closed in both engagement actions** — `revalidateTag('viewer:{user.id}:counts','max')` added inside `if(ownerProfile?.username)` block in `toggleLikeAction` and `addCommentAction`; matches `getBatchedWatchCountsCached` cacheTag scope (Phase 63 Plan 01).
- **text-destructive used for liked Heart chip** — no-raw-palette test forbids `text-red-\d`; `text-destructive` is the design token matching LikeButton; plan specified `text-red-400` but test enforcement required the token (Phase 63 Plan 03 Rule 1 auto-fix).

### Pending Todos

None.

### Blockers/Concerns

None. Phase 60 COMPLETE — all 4 plans, verification passed (10/10 must-haves), prod migration applied + verified.

## Session Continuity

Last activity: 2026-05-27 — Phase 63 Plan 03 COMPLETE. viewerId + liked/canComment threaded from page.tsx RSC through CollectionTabContent + WishlistTabContent into ProfileWatchCard. Overlay ♥/💬 pill chips with scrim (bg-black/55), 44px touch targets, optimistic like (silent rollback on failure), WatchCommentSheet wiring, and canComment gate added to non-owner grid cards. Owner static count line unchanged. Auto-fix: text-destructive used instead of text-red-400 (no-raw-palette test). Commits: e977e25 + 3dd1c84. Build exits 0.
Stopped at: Phase 64 UI-SPEC approved
Next action: Phase verification / deploy to prod
