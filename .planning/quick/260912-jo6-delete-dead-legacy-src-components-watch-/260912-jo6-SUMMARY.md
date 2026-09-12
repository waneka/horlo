---
quick_task: 260912-jo6
subsystem: testing
tags: [dead-code, watch-detail, vitest, static-guard]
status: complete

requirements-completed: [WR-01]

key-files:
  created:
    - tests/components/watch/WatchDetailTrailing.isChronometer.test.tsx
    - tests/static/no-legacy-watch-detail.test.ts
  modified:
    - tests/no-raw-img.test.ts
    - src/app/w/[ref]/page.tsx
    - src/components/notifications/MarkNotificationsSeenOnMount.tsx
    - src/components/watch/WatchPhotoSection.tsx
    - src/data/watches.ts
  deleted:
    - src/components/watch/WatchDetail.tsx
    - tests/components/watch/WatchDetail.isChronometer.test.tsx

key-decisions:
  - "WatchDetail.tsx deleted outright — zero importers confirmed by pre-delete grep (finding 3), so no relocation needed."
  - "FEAT-08/D-11 Certification-row coverage ported verbatim onto WatchDetailTrailing (the live spec card), not re-derived."
  - "no-raw-img guard repointed to the two live image renderers (WatchDetailHero.tsx, WatchPhotoSection.tsx) instead of dropping coverage."
  - "Static re-introduction guard checks existsSync only — no source-text scanning, avoiding comment-prose grep collisions."

duration: ~15min
completed: 2026-09-12
---

# Quick Task 260912-jo6: Delete dead legacy WatchDetail.tsx Summary

**Deleted the unrendered legacy `src/components/watch/WatchDetail.tsx` (dead since Phase 64), migrated its Certification-row test coverage onto the live `WatchDetailTrailing`, repointed the no-raw-img guard to the actually-rendered image components, and added a static re-introduction guard — closing 83-REVIEW WR-01.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3 completed
- **Files modified:** 9 (2 created, 5 modified, 2 deleted)

## Accomplishments

- `src/components/watch/WatchDetail.tsx` no longer exists — the trap that caused Plan 83-03 to edit a dead island (per 83-REVIEW WR-01) is gone.
- FEAT-08/D-11 Certification-row coverage (4/4 cases: true/false/undefined/null) now runs against `WatchDetailTrailing`, the component `/w/[ref]` actually renders.
- `tests/no-raw-img.test.ts` now guards `WatchCard.tsx` + `WatchDetailHero.tsx` + `WatchPhotoSection.tsx` — the live image-rendering surface — instead of a deleted file.
- New `tests/static/no-legacy-watch-detail.test.ts` fails the prebuild if `WatchDetail.tsx` is ever re-created.
- Stale comments across 4 files now describe `WatchDetailHero` (the live island) rather than the dead `WatchDetail`.
- `npm run build` exits 0, including the prebuild `vitest run tests/static/` step (483 tests passed, including the new guard).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate isChronometer Certification tests to WatchDetailTrailing; delete old test** - `8abf4c51` (refactor)
2. **Task 2: Delete WatchDetail.tsx, repoint no-raw-img guard to live renderers, add re-introduction guard** - `02cabc05` (refactor)
3. **Task 3: Fix stale comment references to the live island; run build gate** - `2c686432` (refactor)

## Files Created/Modified

- `tests/components/watch/WatchDetailTrailing.isChronometer.test.tsx` - New Certification-row test targeting the live `WatchDetailTrailing` component (4/4 cases ported verbatim from the deleted test)
- `tests/components/watch/WatchDetail.isChronometer.test.tsx` - Deleted (git rm; only consumer of the dead component)
- `src/components/watch/WatchDetail.tsx` - Deleted (unrendered since Phase 64; zero importers confirmed by grep before deletion)
- `tests/no-raw-img.test.ts` - Guard entries swapped from `WatchDetail.tsx` to `WatchDetailHero.tsx` + `WatchPhotoSection.tsx`; test titles renamed to match
- `tests/static/no-legacy-watch-detail.test.ts` - New tiny `@vitest-environment node` guard asserting `WatchDetail.tsx` does not exist (runs in prebuild)
- `src/app/w/[ref]/page.tsx` - Comment-only: 3 stale "WatchDetail" mentions → "WatchDetailHero" (lines ~66, ~303, ~337); line ~343's historical "monolithic WatchDetail island" mention left unchanged per plan
- `src/components/notifications/MarkNotificationsSeenOnMount.tsx` - Comment-only: `WatchDetail:87/96` line-number reference replaced with named sites `WatchDetailHero handleMarkAsWorn/handleFlagDealChange`
- `src/components/watch/WatchPhotoSection.tsx` - Comment-only: 3 stale "WatchDetail" mentions updated (header attribution, "for WatchDetailHero", legacy fallback line-number reference removed, "same as WatchDetailHero fallback")
- `src/data/watches.ts` - Comment-only: "WatchDetail/WatchPhotoSection" → "WatchDetailHero/WatchPhotoSection"

## Verification

- `npx vitest run tests/components/watch/WatchDetailTrailing.isChronometer.test.tsx` — 4/4 pass
- `test ! -e src/components/watch/WatchDetail.tsx` — confirmed
- `grep -rnE "components/watch/WatchDetail['\"]" src tests scripts` — 0 matches before AND after deletion
- `npx vitest run tests/no-raw-img.test.ts tests/static/no-legacy-watch-detail.test.ts tests/components/watch/WatchDetailHero.removeCopy.test.tsx` — 8/8 pass
- Comment-diff scope check: only the 4 intended files changed, comment-only diffs (9 insertions / 8 deletions total)
- `npm run build` exits 0 (prebuild `tests/static/` = 483/483 passed including the new guard; TypeScript + Turbopack build succeeded; 36 static pages generated)

## Local-First Development Note

Per CLAUDE.md's Local-First exception class, no `npm run dev` walk against local Supabase was performed for this task — it is pure dead-code deletion + test migration + comment edits with zero runtime behavior change (no DAL, Server Action, Server Component, API route, or UI behavior touched). The plan explicitly calls this out (Task 3 action notes) and the build gate (which does exercise the actual RSC route compilation/typecheck) was run and passed.

## Deviations from Plan

None — plan executed exactly as written. All findings from `<planner_findings>` (verified by the planner via prior code reading) held true during execution: zero importers of `WatchDetail.tsx` outside the one test file, `WatchDetailTrailing` mounts with no `vi.mock` needed, and the Certification row logic matched line-for-line.

## Known Stubs

None.

## Threat Flags

None — this task is pure deletion of dead code plus test/guard migration and comment fixes; no new network endpoints, auth paths, file-access patterns, or schema changes were introduced.

## Self-Check: PASSED

- FOUND: tests/components/watch/WatchDetailTrailing.isChronometer.test.tsx
- FOUND: tests/static/no-legacy-watch-detail.test.ts
- MISSING (expected, deleted intentionally): src/components/watch/WatchDetail.tsx
- MISSING (expected, deleted intentionally): tests/components/watch/WatchDetail.isChronometer.test.tsx
- FOUND commit 8abf4c51
- FOUND commit 02cabc05
- FOUND commit 2c686432
