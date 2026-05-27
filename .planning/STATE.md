---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Watch Photos & Detail Redesign
status: executing
stopped_at: Phase 62 UI-SPEC approved
last_updated: "2026-05-27T14:06:47.339Z"
last_activity: 2026-05-27
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 17
  completed_plans: 14
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v7.0 roadmap created)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 62 — public-wear-pics-on-watch-detail

## Current Position

Phase: 62 (public-wear-pics-on-watch-detail) — EXECUTING
Plan: 2 of 4
Status: Executing Phase 62 (Plan 01 complete)
Last activity: 2026-05-27 -- Plan 01 complete (hidden_from_detail schema + local push + Wave 0 test scaffolds)

Progress: [████████░░] 82%

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

### Pending Todos

None.

### Blockers/Concerns

None. Phase 60 COMPLETE — all 4 plans, verification passed (10/10 must-haves), prod migration applied + verified.

## Session Continuity

Last activity: 2026-05-27 — Phase 62 Plan 01 COMPLETE. hidden_from_detail boolean column added to wear_events (schema + local push + prod migration file). Four Wave 0 test scaffolds created; wearRail guardrail passes GREEN.
Stopped at: Phase 62 Plan 01 complete
Next action: Execute Phase 62 Plan 02 (DAL union — getPublicWearPicsForWatch)
