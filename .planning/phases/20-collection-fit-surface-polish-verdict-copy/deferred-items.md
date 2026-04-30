# Phase 20 Deferred Items

Pre-existing failures discovered during Phase 20 execution. None are caused by Phase 20 changes; all are out of scope per the SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current task's changes).

## Plan 20-01 baseline observations (2026-04-30)

Full vitest suite at the end of Plan 20-01 execution: **3 failed test files / 3246 passed / 257 skipped / 66 todo (3575 total)**. The 6 failing tests across 3 files are unrelated to Plan 20-01:

1. **`tests/no-raw-palette.test.ts`** — `src/components/search/WatchSearchRow.tsx does not use /\bfont-medium\b/`. Pre-existing palette-policy regression in the search row component. Plan 20-05 (search accordion) will rewrite this row, so this should self-resolve.

2. **`tests/app/explore.test.tsx`** — 3 failures asserting the "Discovery is coming." stub heading + teaser copy + Sparkles icon. The /explore stub copy has drifted from the test fixture. Owned by Phase 18 (or its successor) — out of Phase 20 scope.

3. **`tests/integration/backfill-taste.test.ts`** — 2 failures: `node: .env.local: not found`. Test invokes `node` with an `--env-file` flag but `.env.local` is not present in this worktree. Environmental, not a code regression.

These failures should be acknowledged by the Phase 20 verifier but should not block Plan 20-01 acceptance.
