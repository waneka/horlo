---
phase: 77-video-capture-display-ui
plan: 01
subsystem: testing
tags: [foundation, cleanup, test-stubs, wave-0, security, vitest, video-capture]

# Dependency graph
requires:
  - phase: 76-video-schema-storage-paths-server-action
    provides: "wear_events.media_type / media_path / poster_path columns + logWearWithVideo Server Action + RLS contract — Phase 77 UI consumes these directly"
provides:
  - "src/app/spike-mr-capture/ removed — T-77-01 (HIGH unauthenticated production route) closed"
  - "11 RED Vitest stub files seeded under tests/hooks/, tests/unit/, tests/components/wywt/, tests/components/wear/, tests/components/home/ — every Wave 1+ implementation has a concrete file to flip from it.todo → real assertion"
  - "77-VALIDATION.md wave_0_complete flag flipped to true — gate for Plan 02+"
affects: [77-02, 77-03, 77-04, 77-05, 77-06, 77-07, 77-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 RED stub convention: `// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md` first-line marker + vitest imports + single describe() + it.todo() callsites + sanity it() so discovery returns 1 passed per file"
    - "Commented-import escape hatch for stubs that reference types not yet created (mediaState.test.ts pattern — `// TODO Plan 02: import type { MediaState } from '@/lib/wywtTypes'`)"

key-files:
  created:
    - tests/hooks/useMediaCapability.test.ts
    - tests/unit/videoCapture.test.ts
    - tests/unit/posterExtraction.test.ts
    - tests/unit/mediaState.test.ts
    - tests/unit/dalMediaColumns.test.ts
    - tests/components/wywt/VideoCaptureView.test.tsx
    - tests/components/wywt/ComposeStep.video.test.tsx
    - tests/components/wywt/ComposeStep.submit.video.test.tsx
    - tests/components/wear/WearVideoClient.test.tsx
    - tests/components/wear/WearCard.video.test.tsx
    - tests/components/home/WywtTile.video.test.tsx
  modified:
    - .planning/phases/77-video-capture-display-ui/77-VALIDATION.md
  deleted:
    - src/app/spike-mr-capture/page.tsx (single-file directory; entire dir removed)

key-decisions:
  - "Stubs use `it.todo(...)` (Vitest 3 idiom) — not `it.skip` and not `it(...).skip()` — so the suite reports `↓ todo` instead of `× failed`"
  - "Each stub adds one sanity `it('stub: vitest module discovery + import resolution', ...)` so each file contributes `1 passed` (= 11 passed total) to summary line, giving downstream feedback loops a positive signal that discovery worked"
  - "`tests/unit/mediaState.test.ts` keeps the `MediaState` import COMMENTED out — Plan 02 introduces the type, and Wave 0 cannot depend on Plan 02 (would block its own preconditions)"
  - "No redirect file added for /spike-mr-capture — 404 is the correct end state (spike was never user-facing)"

patterns-established:
  - "Wave 0 scaffolding pattern: every test stub file follows identical shape (marker header, vitest imports, describe(), N it.todo() entries, 1 sanity it()) — keeps grep-based discovery cheap and consistent"
  - "Nyquist sampling precondition: feedback-loop sampling targets in 77-VALIDATION.md §Per-Task Verification Map now resolve to real files (prior state was ❌ W0 across the board)"

requirements-completed: []  # Plan 01 is foundation/scaffolding — no VID-* requirements flip green here; they flip when Wave 2+ replaces it.todo with real assertions

# Metrics
duration: ~8 min (executor portion)
completed: 2026-06-23
---

# Phase 77 Plan 01: Wave 0 Foundation Summary

**Removed the unauthenticated `/spike-mr-capture` production route (T-77-01) and seeded 11 RED Vitest stub files across tests/hooks/, tests/unit/, tests/components/wywt/, tests/components/wear/, tests/components/home/ — every Wave 1+ implementation now has a concrete file to flip from `it.todo` → real assertion per the Nyquist sampling contract in 77-VALIDATION.md.**

## Performance

- **Duration:** ~8 min (executor portion)
- **Started:** 2026-06-23T13:52:43Z (from STATE.md last_updated)
- **Completed:** 2026-06-23T14:00:04Z
- **Tasks:** 2
- **Files modified:** 13 (1 deleted + 11 created + 1 modified)

## Accomplishments

- **T-77-01 closed (HIGH severity):** `src/app/spike-mr-capture/` removed from the working tree as a tracked deletion. Vercel's next deploy publishes 404 for `/spike-mr-capture`. No redirect / replacement file added — 404 is the correct end state for a spike route that was never user-facing.
- **11 RED Vitest stub files seeded** under the exact paths listed in 77-VALIDATION.md §Wave 0 Requirements. Each file uses the Wave 0 RED stub pattern (marker header, vitest imports, describe(), `it.todo()` callsites for each forward-looking case, plus a sanity `it()` so discovery returns a positive 1-passed signal).
- **77-VALIDATION.md `wave_0_complete` flag flipped** false → true. Gate satisfied for Plan 02+ to begin.
- **Baseline gate green:** `npm run build` exits 0 after both tasks (per durable memory `project_baseline_not_green_build_is_gate`). Vitest run across the 11 new stubs: **11 passed | 32 todo (43) | 0 failed**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete src/app/spike-mr-capture/ (T-77-01 cleanup)** — `75b00386` (chore)
   - `git rm -r src/app/spike-mr-capture/` (367-line page.tsx, single-file dir)
   - npm run build exit 0 verified after deletion (no orphan-import errors)
2. **Task 2: Seed 11 RED Vitest stub files + flip wave_0_complete** — `b0cdd52c` (test)
   - 11 new stub files created at the exact paths in 77-01-PLAN.md `<files>`
   - 77-VALIDATION.md `wave_0_complete: false` → `true`
   - Vitest run on the 11 stubs: 11 passed | 32 todo | 0 failed
   - npm run build exit 0

**Plan metadata commit:** will follow (SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created/Modified

### Deleted
- `src/app/spike-mr-capture/page.tsx` — spike test page (367 LOC). Directory now absent.

### Created (Wave 0 stubs — every Wave 1+ implementation has a corresponding stub to flip green)
- `tests/hooks/useMediaCapability.test.ts` — RED stub for `useMediaCapability` probe (VID-01, VID-04)
- `tests/unit/videoCapture.test.ts` — RED stub for MediaRecorder 3s timer + cancel guard (VID-02, VID-03)
- `tests/unit/posterExtraction.test.ts` — RED stub for canvas seek + toBlob (VID-05)
- `tests/unit/mediaState.test.ts` — RED stub for discriminated `MediaState` union (VID-06) — import commented until Plan 02
- `tests/unit/dalMediaColumns.test.ts` — RED stub for WR-02 DAL column inclusion across 4 readers
- `tests/components/wywt/VideoCaptureView.test.tsx` — RED stub for VideoCaptureView render + discard + stream-as-prop guard
- `tests/components/wywt/ComposeStep.video.test.tsx` — RED stub for 3-button chooser + capability hide (VID-01, D-04)
- `tests/components/wywt/ComposeStep.submit.video.test.tsx` — RED stub for submit pipeline integration (VID-01, VID-06)
- `tests/components/wear/WearVideoClient.test.tsx` — RED stub for autoplay attrs + error fallback (VID-14, D-06)
- `tests/components/wear/WearCard.video.test.tsx` — RED stub for video branch (VID-13) + VID-15 regression
- `tests/components/home/WywtTile.video.test.tsx` — RED stub for VideoPlayBadge overlay (VID-13)

### Modified
- `.planning/phases/77-video-capture-display-ui/77-VALIDATION.md` — frontmatter `wave_0_complete: false` → `true`

## Decisions Made

- **`it.todo` not `it.skip`** — Vitest 3's todo idiom reports as `↓ todo` rather than skipped/failed, which keeps the suite's red/green signal pristine for Wave 1+ feedback loops.
- **Sanity `it()` per file** — each stub contributes one positive assertion so `Test Files 11 passed (11)` appears on the summary line. Without it, discovery-only failures would be indistinguishable from "file empty" reports.
- **`MediaState` import commented in `mediaState.test.ts`** — Plan 02 introduces the type. If we imported it now, Wave 0 would block on Plan 02 (circular precondition). The `// TODO Plan 02: ...` comment makes the uncomment step a literal grep target for Plan 02's task list.
- **No `/spike-mr-capture` redirect** — the route was a spike (per Spike 001 README cleanup note), never linked from the app, never user-facing. 404 is correct.

## Vitest todo count (before vs after)

- **Before:** 0 todos under the 11 target paths (files did not exist).
- **After:** 32 todos across 11 files (callsite count; ranges from 1 todo in `mediaState.test.ts` to 4 todos in `useMediaCapability.test.ts` / `dalMediaColumns.test.ts` / `VideoCaptureView.test.tsx`).
- Each Wave 1+ implementation task flips its corresponding todos green by adding real `it(...)` assertions in place of `it.todo(...)`.

## Deviations from Plan

None — plan executed exactly as written. The plan's <files> list, per-file `<action>` content, and verification block all matched the work performed verbatim.

## Issues Encountered

None.

## Build & Test Verification

- `npm run build` after Task 1 (spike deletion): **EXIT=0**, `✓ Compiled successfully in 5.9s`
- `npm run build` after Task 2 (11 stubs + flag flip): **EXIT=0**, `✓ Compiled successfully in 5.8s`
- `npx vitest run` over the 11 new stubs: **Test Files 11 passed (11) | Tests 11 passed | 32 todo (43)**

## User Setup Required

None — Plan 01 is foundation/scaffolding only; no external services touched.

## Next Phase Readiness

- **Plan 02 unblocked:** `wave_0_complete: true` gate satisfied; Plan 02 can begin (will introduce `MediaState` type at `@/lib/wywtTypes`, then uncomment the import in `tests/unit/mediaState.test.ts` and replace the single `it.todo` with the 3 real cases from 77-PATTERNS.md §mediaState.test.ts).
- **Wave 1 foundation in place:** DAL column stub (`tests/unit/dalMediaColumns.test.ts`) and `MediaState` type stub are the structural anchors Plan 02 needs.
- **No deferred items.**

## Self-Check: PASSED

- `src/app/spike-mr-capture` directory: ABSENT ✓
- 11 stub files: all FOUND ✓
- `it.todo(` callsites: ≥1 per file (range 1–4, total 32) ✓
- Marker `// Wave 0 RED stub — Phase 77` on first line of every stub ✓
- `wave_0_complete: true` in 77-VALIDATION.md ✓
- Task 1 commit `75b00386`: FOUND in git log ✓
- Task 2 commit `b0cdd52c`: FOUND in git log ✓
- `npm run build` exit 0 ✓
- Vitest on 11 stubs: 11 passed | 32 todo | 0 failed ✓

---
*Phase: 77-video-capture-display-ui*
*Plan: 01*
*Completed: 2026-06-23*
