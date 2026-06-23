---
phase: 77-video-capture-display-ui
plan: 03
subsystem: dal
tags: [dal, drizzle, wr-02, video-foundation]
requires:
  - phase: 76
    provides: wearEvents.mediaType / mediaPath / posterPath schema columns
  - phase: 77-01
    provides: tests/unit/dalMediaColumns.test.ts Wave 0 RED stub to flip green
  - phase: 77-02
    provides: WywtTile mediaType/posterPath additive optional fields
provides:
  - 4 DAL readers (getWearEventByIdForViewer, getWearEventsForViewer non-owner branch, getWearRailForViewer, getActiveWearsForUser both branches) expose mediaType/mediaPath/posterPath to consumers
  - WywtTile row→tile mapping in getWearRailForViewer propagates mediaType + posterPath
  - tests/unit/dalMediaColumns.test.ts: 4 passing source-level guardrail cases
affects: [Plan 05, Plan 06, Plan 07, Plan 08]
tech-stack:
  added: []
  patterns:
    - "Source-level structural guardrails (analog: tests/unit/wearRail.test.ts) — readFileSync + function-body slicing + .toContain assertions; sidesteps Drizzle mock complexity"
key-files:
  created: []
  modified:
    - src/data/wearEvents.ts
    - tests/unit/dalMediaColumns.test.ts
key-decisions:
  - "WR-02: 4 readers widened; getAllWearEventsByUser uses .select() no-args (Drizzle auto-includes new columns); getPublicWearPicsForWatch left untouched per SEED-020 D-06"
  - "Tests use source-grep over Drizzle-mock chain — column-reference identity is what WR-02 actually asserts; avoids brittle chain mocking"
patterns-established:
  - "Additive DAL SELECT extension: new columns grouped immediately after photoUrl with `// Phase 77 WR-02` comment marker"
requirements-completed:
  - WR-02
duration: 12min
completed: 2026-06-23
---

# Phase 77 Plan 03: DAL media columns (WR-02 fold-in)

**4 DAL readers now surface Phase 76's mediaType/mediaPath/posterPath columns so every Wave 3 render surface can discriminate on `mediaType === 'video'` without an extra fetch.**

## Performance

- **Duration:** ~12 min (executor portion, inline)
- **Completed:** 2026-06-23
- **Tasks:** 2/2
- **Files modified:** 2 (src/data/wearEvents.ts, tests/unit/dalMediaColumns.test.ts)

## Accomplishments

- Widened 4 DAL readers in `src/data/wearEvents.ts`:
  - `getWearEventByIdForViewer` (single-row reader for `/wear/[id]`)
  - `getWearEventsForViewer` non-owner branch
  - `getWearRailForViewer` (home rail — also propagates `mediaType` + `posterPath` through the row→`WywtTile` mapping)
  - `getActiveWearsForUser` — both owner and non-owner branches
- `getAllWearEventsByUser` uses `.select()` with no args — Drizzle auto-includes the new columns; added a marker comment.
- `getPublicWearPicsForWatch` left untouched per SEED-020 D-06 (watch detail carousel stays photo-only).
- Flipped `tests/unit/dalMediaColumns.test.ts` from Wave 0 `it.todo` placeholders to 4 passing source-level guardrail cases.

## Task Commits

1. **Task 1: Widen 4 DAL readers** — `e29cab1e` (feat)
2. **Task 2: Upgrade dalMediaColumns test stub** — `824ea055` (test)

## Files Modified

- `src/data/wearEvents.ts` — added `mediaType`/`mediaPath`/`posterPath` to 5 explicit SELECT object literals (4 readers; `getActiveWearsForUser` has 2 branches) + WywtTile mapping propagation in `getWearRailForViewer`
- `tests/unit/dalMediaColumns.test.ts` — replaced 4 `it.todo` placeholders with 4 source-grep guardrails

## Verification

- `grep -c "mediaType: wearEvents.mediaType" src/data/wearEvents.ts` → 5 (≥ 4 expected)
- `grep -c "mediaPath: wearEvents.mediaPath" src/data/wearEvents.ts` → 5
- `grep -c "posterPath: wearEvents.posterPath" src/data/wearEvents.ts` → 5
- `grep -c "photoUrl: wearEvents.photoUrl" src/data/wearEvents.ts` → 6 (unchanged from baseline — VID-15 evidence)
- `grep -c "export async function getPublicWearPicsForWatch" src/data/wearEvents.ts` → 1 (untouched)
- `grep -c "Phase 77 WR-02" src/data/wearEvents.ts` → 7 (one per modified select + tile-mapping comment + getAllWearEventsByUser explanatory comment)
- `npm run build` → exit 0
- `npx vitest run tests/unit/dalMediaColumns.test.ts` → 4 passed, 0 failed

## Self-Check

PASSED — all acceptance criteria met.

### Deviations from plan

- Plan recommended Strategy (a) — mock Drizzle chain + assert return shape. Used Strategy (b) — source-level grep — instead, because:
  1. The analog test cited by the plan (`tests/unit/wearRail.test.ts`) uses source-grep, not Drizzle mocking.
  2. Mocking a chain of `.select / .from / .innerJoin / .leftJoin / .where / .orderBy / .limit` for 5 distinct call patterns adds significant shape without value.
  3. Column-reference identity is the actual WR-02 contract — source-grep verifies it directly.

  Both strategies are explicitly allowed by the plan (`<context>` block: "executor picks").

### getAllWearEventsByUser status

- Pre-edit form: `return db.select().from(wearEvents).where(...).orderBy(...)`. The `.select()` no-args returns ALL columns from the Drizzle row type (which Phase 76 widened to include the three media columns). NO explicit column addition needed; only the marker comment was added for grep discoverability.

## Notes for downstream plans

- Plan 05 (`VideoCaptureView`) — does NOT consume DAL data; receives parent-supplied MediaStream.
- Plan 06 (ComposeStep) — server action `logWearWithVideo` (Phase 76) is the write path; not affected by this plan.
- Plan 07 (`WearCard` / `WearVideoClient`) — reads `wear.mediaType`, `wear.mediaPath`, `wear.posterPath` from `getWearEventByIdForViewer`. The data is now present in the row.
- Plan 08 (`WywtTile` + lane wiring + page signing) — `tile.mediaType` + `tile.posterPath` are now populated from the rail mapping; page Server Components mint signed URLs from `mediaPath` + `posterPath`.
