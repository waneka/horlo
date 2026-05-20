# Phase 49.1 — Deferred Items

## Pre-existing test failures (out of scope for Plan 06)

### `tests/integration/backfill-taste.test.ts` — node: .env.local: not found

**Discovered:** 2026-05-19, during Plan 06 full-suite verification.
**Root cause:** The reenrich-taste.ts script invocation tries to load
`.env.local` and the helper that wraps the spawn doesn't have a path or
the test infra changed. Pre-existing — reproduces on the Plan 06 base
commit before any Plan 06 edits (confirmed via `git stash` + `vitest run
tests/integration/backfill-taste.test.ts`).
**Impact:** 2 of 14 test cases in the file fail (out of 5,568 in the full
suite); the rest of the suite is green.
**Recommendation:** investigate during the next polish phase or add to
v5.2 cleanup.

## Other deferred items

(none — Plan 06 in-scope edits are complete)
