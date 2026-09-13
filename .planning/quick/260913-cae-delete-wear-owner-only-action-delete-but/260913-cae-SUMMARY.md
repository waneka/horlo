---
phase: quick-260913-cae
plan: 01
subsystem: wear-events
tags: [server-action, dal, dialog, idor, storage-cleanup]
dependency-graph:
  requires: []
  provides:
    - "deleteWearEventForOwner (src/data/wearEvents.ts)"
    - "deleteWearEvent Server Action (src/app/actions/wearEvents.ts)"
    - "WearDeleteButton component (src/components/wear/WearDeleteButton.tsx)"
  affects:
    - "src/app/wear/[wearEventId]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "db.transaction owner-scoped delete with jsonb scalar cleanup (no = ANY arrays)"
    - "useTransition + controlled Dialog confirm pattern (WipeCollectionModal analog)"
key-files:
  created:
    - tests/integration/wear-delete-dal.test.ts
    - tests/actions/wearEventsDelete.test.ts
    - src/components/wear/WearDeleteButton.tsx
    - tests/components/wear/WearDeleteButton.test.tsx
  modified:
    - src/data/wearEvents.ts
    - src/app/actions/wearEvents.ts
    - src/app/wear/[wearEventId]/page.tsx
decisions:
  - "DD-1 activity matching: 60s window keyed off the wear's created_at, with an ambiguity guard against sibling wears of the same user+watch"
  - "DD-5: standalone WearDeleteButton below WearDetailMetadata, not folded into WearOverflowMenu/WearCard (shared component, focus-return complexity)"
metrics:
  duration: ~45min
  completed: 2026-09-13
---

# Phase quick-260913-cae Plan 01: Delete Wear (owner-only) Summary

Added owner-only permanent deletion of a single wear entry, end to end: a transactional DAL function with IDOR-safe ownership scoping and DD-1/DD-2 dangling-reference cleanup, a Server Action wrapping it with strict validation and non-fatal owner-prefixed storage cleanup, and a client confirmation-dialog component wired into the live `/wear/[wearEventId]` page.

## What Was Built

**Task 1 — `deleteWearEventForOwner` DAL (`src/data/wearEvents.ts`):**
- `WORN_ACTIVITY_MATCH_WINDOW_MS = 60_000` exported constant.
- `deleteWearEventForOwner(userId, wearEventId)` runs entirely inside one `db.transaction`:
  1. SELECT scoped to `eq(wearEvents.id, ...) AND eq(wearEvents.userId, userId)` — returns `null` for both missing and cross-user ids (IDOR-safe by construction, independent of any UI gate).
  2. **DD-1 activity matching rule**: if another wear of the same user+watch has `created_at` within ±60s of the deleted wear, the match is **ambiguous** and no `watch_worn` activity is touched. Otherwise, the activity dated `[wear.createdAt, wear.createdAt + 60s]` for that user+watch is deleted (`matched` if a row was removed, `none` otherwise — e.g. past-date backfills write no activity by design).
     - **Accepted edge case (documented in the DAL doc comment)**: `markAsWorn`'s `onConflictDoNothing` can still log a phantom duplicate activity on a same-day re-tap. If that phantom lands inside a *different* wear's 60s window, it gets removed alongside that wear — but since it's already a duplicate of an existing activity, this never hides a real, unique wear from the feed. The rule intentionally never risks deleting an activity that could belong to another wear.
  3. **DD-2 exact-id cleanup**: `wear_like`/`wear_comment` notifications with `payload->>'wear_event_id' = id` and `'commented'` activities with `metadata->>'wearEventId' = id` are deleted via scalar jsonb comparisons (no `= ANY(${arr})` arrays anywhere — grep-armored at 0 occurrences).
  4. Final DELETE on `wear_events` (cascades `wear_likes` + `comments`).
  5. Returns `{ watchId, storagePaths, activityMatch, removedActivityCount }` — storage removal is explicitly the caller's job (DD-3).
- `tests/integration/wear-delete-dal.test.ts`: DATABASE_URL-gated suite (11 tests), covering IDOR, cascade, all three DD-1 branches (matched / 10-min-out-of-window / different-watch), the ambiguity guard, DD-2 notification + commented-activity cleanup with a surviving control row, and storagePaths shape. Ran against local Supabase — all 11 pass. Required creating test-fixture `brands`/`watch_families` rows because `watches_catalog.brand_id`/`family_id` are NOT NULL post-Phase-80 (an unrelated pre-existing tsc baseline error already affects most other integration test files that insert `watchesCatalog` without these FKs — this new file avoids it by seeding real brand/family rows).

**Task 2 — `deleteWearEvent` Server Action (`src/app/actions/wearEvents.ts`):**
- `deleteWearEventSchema = z.object({ wearEventId: z.string().uuid() }).strict()` — rejects extra keys (mass-assignment).
- Pipeline: auth → zod → `deleteWearEventForOwner(user.id, ...)` → uniform `'Wear not found'` on `null` (no existence leak) → non-fatal storage cleanup (only paths starting with `${user.id}/` and without `..` are ever passed to `.remove()`; dropped paths are logged) → cache invalidation (`revalidatePath('/')`, `revalidatePath('/w/[ref]', 'page')`, `updateTag('profile:<username>')`, `updateTag('viewer:<userId>')`) → returns `{ username }`.
- `tests/actions/wearEventsDelete.test.ts`: 16 unit tests covering auth gate, zod gate, mass-assignment, DAL-null → uniform error, DAL-throw → generic error, photo/video/no-media storage paths, unsafe-path filtering, non-fatal storage failure (both `{ error }` and thrown), full cache-invalidation assertion set, ambiguous-match warning, and missing-profile fallback.

**Task 3 — `WearDeleteButton` + page wiring:**
- `src/components/wear/WearDeleteButton.tsx`: controlled Dialog + `useTransition`, ghost-variant trigger (`text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20`), destructive-variant confirm button, error state that resets on dialog open (not on mount). On success: `toast('Wear deleted')` then `router.replace('/u/<username>/worn')` (never `push`/`back`, so browser Back cannot return to the deleted `/wear/[id]`).
- `src/app/wear/[wearEventId]/page.tsx`: renders `<WearDeleteButton>` only when `wear.userId === viewerId` (server-derived — the client component performs no additional ownership check; the Server Action's DAL scoping is the real gate).
- `tests/components/wear/WearDeleteButton.test.tsx`: 7 tests covering render/no-premature-dialog, open + copy, Cancel (with disappearance assertion), Confirm double-submit guard + pending state, success navigation/toast, failure inline alert with no navigation, and stale-error reset on reopen.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was in the integration test's fixture setup: `watchesCatalog` inserts needed explicit `brandId`/`familyId` values (not spelled out in the plan's interfaces section) because those columns were flipped to `NOT NULL` in Phase 80, after the phase15 test this task's test mirrors was written. This is a pre-existing tsc baseline issue in several other integration test files; this new file avoids tripping it by seeding real `brands`/`watch_families` rows in `beforeAll`.

## Known Stubs

None.

## Threat Flags

None — all new surface (the `deleteWearEvent` Server Action, the DAL delete, and the storage `.remove()` call) is exactly what the plan's `<threat_model>` anticipated and mitigates (T-QK-IDOR, T-QK-STORAGE, T-QK-MASS, T-QK-OVERDELETE, T-QK-INFO all implemented as specified).

## Verification

- `npx tsc --noEmit -p tsconfig.json` — no errors in any of the 6 files this plan touched/created (pre-existing errors in unrelated files, including the same `watchesCatalog` FK issue in `phase15-wear-detail-gating.test.ts` and `phase76-video-schema.test.ts`, are baseline).
- `npx vitest run tests/actions/wearEventsDelete.test.ts tests/components/wear/WearDeleteButton.test.tsx tests/integration/wear-delete-dal.test.ts` (against local Supabase, `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`) — **34/34 pass**.
- `npx vitest run tests/no-raw-palette.test.ts` — 5 pre-existing failures in unrelated files (documented baseline); `WearDeleteButton.tsx` itself has zero matches against the forbidden pattern list.
- `git diff --name-only` confirms `WearCard.tsx`, `WearOverflowMenu.tsx`, and `WearDetailHero.tsx` were not touched.
- `npm run build` — **exit 0**.

## Operator Local Walk — PENDING (required before push per CLAUDE.md Local-First Development)

The executor ran the automated DB-gated integration suite against local Supabase (11/11 pass), but the full end-to-end UI + storage + notification walk described in the plan's `<verification>` section has **not** been performed and must be run in `npm run dev` against local Supabase before this change is pushed:

1. `npm run dev` against local Supabase; sign in as `vintage-anna@horlo.test` / `password123`.
2. Log a wear with a photo today (creates a `watch_worn` activity) and open `/wear/<id>`; confirm "Delete wear" is visible.
3. Sign in as `viewer@horlo.test` in another browser, open the same `/wear/<id>`; confirm no delete control. Like and comment on it.
4. Back as vintage-anna: Delete wear → Cancel (nothing changes) → Delete wear → Delete. Expect toast "Wear deleted" and landing on `/u/vintage-anna/worn` without the wear; browser Back does not show the deleted wear page.
5. SQL spot-check via `docker exec psql` on the local DB: no `wear_events` row for the id; no `watch_worn` activity for that user+watch in the window; no `wear_like`/`wear_comment` notification with `payload wear_event_id = id`; `select name from storage.objects where bucket_id='wear-photos' and name like '<anna-uid>/<id>%'` returns 0 rows.
6. As `viewer@horlo.test`, reload home: no feed row for the deleted wear or the comment on it.

## Self-Check: PASSED

All 7 files created/modified by this plan verified present on disk; all 3 task commits (`fec90251`, `d45653fd`, `8ad4834c`) verified present in `git log`.
